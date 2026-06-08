'use server'

/**
 * staffing クイック登録（②AIウィザード / REQ-0016・REQ-0004・ADR-0004/0012）
 *
 * 貼付テキスト → AI(Groq等) で構造化 → 確認画面 → apply で案件起票（draft-then-apply）。
 * AI は DB を直接触らず、apply 層（本ファイル）が requireEditor + ensureModuleEnabled を通して反映。
 */
import { db } from '@/lib/db'
import { assignments } from '@/lib/schema'
import { requireEditor } from '@/lib/auth'
import { ensureModuleEnabled } from '@/lib/modules/registry'
import { callAI } from '@/lib/ai/client'
import { generateAssignmentNo } from '@/industries/staffing/lib/assignmentNo'
import { revalidatePath } from 'next/cache'

/** AI が返す下書きの型（確認画面で編集後に apply へ渡す） */
export type StaffingDraft = {
  intent?: string
  role?: string
  headcount?: number | null
  work_date?: string | null     // YYYY-MM-DD
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  client_rate?: number | null   // 発注単価
  client_name?: string | null
  note?: string | null
  ambiguities?: string[]
}

function todayISO(): string {
  // サーバー時刻（JST想定）— 相対日付解決の基準
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 貼付テキストを AI で構造化（DBは触らない） */
export async function parseQuickText(rawText: string): Promise<StaffingDraft> {
  await requireEditor()
  await ensureModuleEnabled('staffing')

  const text = (rawText ?? '').trim()
  if (!text) throw new Error('テキストが空です')

  const system = [
    'あなたは人材手配会社の受付アシスタントです。',
    'クライアントからの依頼文（LINE等）から、案件情報を抽出して**厳密なJSONのみ**を返してください。',
    '前置き・説明・マークダウンのコードフェンスは一切付けないこと。',
    `現在日時の基準は ${todayISO()} です。「明日」「来週」等の相対表現は YYYY-MM-DD の絶対日付へ解決してください。`,
    '金額表現（「2万」等）は数値（円）へ正規化してください（例: 20000）。',
    '出力するJSONの形:',
    '{',
    '  "intent": "new_job",',
    '  "role": "募集職種や内容(文字列, 不明はnull)",',
    '  "headcount": 人数(整数, 不明はnull),',
    '  "work_date": "YYYY-MM-DD or null",',
    '  "start_time": "HH:MM or null",',
    '  "end_time": "HH:MM or null",',
    '  "location": "場所 or null",',
    '  "client_rate": 発注単価(数値 or null),',
    '  "client_name": "クライアント名 or null",',
    '  "note": "補足 or null",',
    '  "ambiguities": ["曖昧だった点(あれば)"]',
    '}',
  ].join('\n')

  const result = await callAI({ system, user: text, temperature: 0.1, maxTokens: 800 })

  // ```json フェンス等が混じった場合に備えて最初の { ... } を抽出
  const raw = result.text ?? ''
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('AI応答をJSONとして解釈できませんでした。文面を変えて再実行してください。')
  }
  let parsed: StaffingDraft
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as StaffingDraft
  } catch {
    throw new Error('AI応答のJSON解析に失敗しました。再実行してください。')
  }
  return parsed
}

/** 確認済みの下書きから案件を起票（apply層）。新規 assignment の id を返す。 */
export async function applyQuickDraft(draft: StaffingDraft, rawText: string): Promise<string> {
  await requireEditor()
  await ensureModuleEnabled('staffing')

  // クライアント名は取引先IDに自動解決しない（後で画面で確定）。memo/説明に残す。
  const memoParts = [
    draft.client_name ? `クライアント: ${draft.client_name}` : null,
    draft.note ? `補足: ${draft.note}` : null,
    draft.ambiguities && draft.ambiguities.length ? `要確認: ${draft.ambiguities.join(' / ')}` : null,
  ].filter(Boolean)

  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await generateAssignmentNo()
    try {
      const [row] = await db.insert(assignments).values({
        assignment_no:        no,
        // client_account_id は後で画面で確定（AIは社名のみ）
        role:                 draft.role ?? null,
        service_date:         draft.work_date ?? null,
        service_start_time:   draft.start_time ?? null,
        service_end_time:     draft.end_time ?? null,
        service_location:     draft.location ?? null,
        service_description:  draft.role ?? null,
        staff_count_required: typeof draft.headcount === 'number' ? draft.headcount : null,
        client_total_fee:     draft.client_rate != null ? String(draft.client_rate) : null,
        status:               '受付',
        internal_memo:        memoParts.join('\n') || null,
        raw_message:          rawText ?? null,
      }).returning({ id: assignments.id })
      revalidatePath('/assignments')
      return row.id
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!/assignment_no|unique|duplicate/i.test(msg)) throw e
    }
  }
  throw new Error('案件番号の採番に失敗しました。再度お試しください。' + (lastErr ? ` (${(lastErr as Error).message})` : ''))
}
