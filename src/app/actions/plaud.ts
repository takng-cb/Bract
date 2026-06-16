'use server'

/**
 * PLAUD Note 共有リンクから活動記録の項目を生成する（#143 / REQ-0077）。
 *
 * フロー: リンク → 文字起こし/AI要約を取得（src/lib/plaud）→ callAI で
 * 件名/種別/要点・次アクションを抽出 → 本文に PLAUD の AI 要約も転記。
 * コンテナ別フラグ `plaud_import` で有効化された時だけ動く。
 */
import { ensureFeature } from '@/lib/license'
import { fetchPlaudContent, PlaudError } from '@/lib/plaud'
import { callAI } from '@/lib/ai/client'
import { getActivityTypes } from '@/lib/activityTypes'

export type PlaudImportResult =
  | {
      ok: true
      fields: { type?: string; subject: string; body: string }
      meta: { title: string; hasSummary: boolean; transcriptChars: number; aiUsed: boolean }
    }
  | { ok: false; error: string }

/** 文字起こしから件名/種別/要点を抽出した結果（ベストエフォート） */
type AiExtract = { type?: string; subject?: string; keypoints?: string }

function parseAiJson(text: string): AiExtract {
  // ```json フェンスや前後の余分を許容
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < 0) return {}
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AiExtract
  } catch {
    return {}
  }
}

export async function importActivityFromPlaud(url: string): Promise<PlaudImportResult> {
  // 1. フラグ（コンテナ別 ON のみ）
  try {
    await ensureFeature('plaud_import')
  } catch {
    return { ok: false, error: 'PLAUD 取り込みは有効化されていません。管理者にお問い合わせください。' }
  }

  // 2. PLAUD から取得（host 許可リスト・認証不要・リージョン -302 対応は lib 内）
  let content
  try {
    content = await fetchPlaudContent(url)
  } catch (e) {
    return { ok: false, error: e instanceof PlaudError ? e.message : 'PLAUD の取得に失敗しました。リンクをご確認ください。' }
  }

  // 3. AI 抽出（transcript → 件名/種別/要点）。AI 未設定でも要約転記でフォールバック。
  const types = await getActivityTypes()
  const typeList = types.map((t) => `${t.value}=${t.label}`).join(', ')
  let ai: AiExtract = {}
  let aiUsed = false
  if (content.transcript) {
    try {
      const res = await callAI({
        system: '会議/商談の文字起こしから CRM の活動記録を作るアシスタント。必ず JSON オブジェクトのみを返す。',
        user: `次の文字起こしから活動記録用 JSON を作成。
キー:
- "type": 次の value から最も近いもの（${typeList}）。不明なら "meeting"。
- "subject": 30文字以内の簡潔な日本語の件名。
- "keypoints": 要点と次アクションを「- 」始まりの箇条書きでまとめた日本語本文（最大10行）。

タイトル: ${content.title}
文字起こし:
${content.transcript.slice(0, 12000)}`,
        maxTokens: 1024,
        temperature: 0.2,
      })
      ai = parseAiJson(res.text)
      aiUsed = true
    } catch {
      // AI 無効/失敗 → フォールバック（要約をそのまま使う）
    }
  }

  // 4. 本文 = AI 要点 ＋ PLAUD の AI 要約（転記）。両方無ければ文字起こし冒頭。
  const parts: string[] = []
  if (ai.keypoints?.trim()) parts.push(ai.keypoints.trim())
  if (content.summary) parts.push(`【PLAUD 要約】\n${content.summary}`)
  const body = parts.join('\n\n') || content.transcript.slice(0, 4000)

  const type = types.some((t) => t.value === ai.type) ? ai.type : undefined
  const subject = (ai.subject?.trim() || content.title || 'PLAUD 取り込み').slice(0, 80)

  return {
    ok: true,
    fields: { type, subject, body },
    meta: { title: content.title, hasSummary: !!content.summary, transcriptChars: content.transcript.length, aiUsed },
  }
}
