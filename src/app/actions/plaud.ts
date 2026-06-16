'use server'

/**
 * PLAUD Note のエクスポート markdown/テキストから活動記録の項目を生成する（#143 / REQ-0077）。
 *
 * サーバからの共有リンク取得は PLAUD の Cloudflare に本番サーバIPが弾かれ不安定なため廃止。
 * ユーザーが PLAUD でエクスポートした markdown をアップロード → パース → 活動項目へ。
 * 構造（タイトル/セクション要約/アクションアイテム）が明確なので AI 抽出は不要。
 * コンテナ別フラグ `plaud_import` で有効化された時だけ動く。
 */
import { db } from '@/lib/db'
import { tasks, activities, activity_related_records } from '@/lib/schema'
import { revalidatePath } from 'next/cache'
import { ensureFeature } from '@/lib/license'
import { requirePermission } from '@/lib/permissions'
import { parsePlaudMarkdown, PlaudParseError, type PlaudActionItem } from '@/lib/plaud/markdown'
import { getActivityTypes } from '@/lib/activityTypes'
import { callAI } from '@/lib/ai/client'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import { assertAiRateLimit } from '@/lib/ai/rateLimit'
import { getCurrentUserId } from '@/lib/auth'

const MAX_LEN = 300_000 // アップロード本文の上限（約300KB）

/** AI 応答テキストから最初の JSON オブジェクトを取り出す。 */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown> } catch { return null }
}

export type PlaudImportResult =
  | {
      ok: true
      fields: { type?: string; subject: string; body: string }
      /** アクションアイテム（確認画面で ToDo 化を選択させる） */
      actionItems: PlaudActionItem[]
      meta: { hasSummary: boolean }
    }
  | { ok: false; error: string }

export async function importActivityFromPlaud(markdown: string): Promise<PlaudImportResult> {
  try {
    await ensureFeature('plaud_import')
  } catch {
    return { ok: false, error: 'PLAUD 取り込みは有効化されていません。管理者にお問い合わせください。' }
  }

  const text = (markdown ?? '').slice(0, MAX_LEN)
  if (!text.trim()) return { ok: false, error: 'ファイルが空です。' }

  let parsed
  try {
    parsed = parsePlaudMarkdown(text)
  } catch (e) {
    return { ok: false, error: e instanceof PlaudParseError ? e.message : 'PLAUD ファイルの解析に失敗しました。' }
  }

  // 種別は「打合せ」を既定に（活動種別に meeting があれば）
  const types = await getActivityTypes()
  const type = types.find((t) => t.value === 'meeting')?.value

  return {
    ok: true,
    fields: {
      type,
      subject: parsed.title.slice(0, 120),
      body: parsed.body,
    },
    actionItems: parsed.actionItems,
    meta: { hasSummary: !!parsed.summary },
  }
}

// ────────────────────────────────────────────────────────────────
// 複数案件の分割（AI セグメンテーション。REQ-0077 拡張）
//   1つの議事録に複数案件が含まれる場合、案件ごとのセグメントに分割し、
//   それぞれを「その案件の活動記録」として作成できるようにする。
//   AI は分割案を返すだけ（draft-then-apply）。作成は確認画面の確定後。
// ────────────────────────────────────────────────────────────────
export type PlaudSegment = {
  title:        string
  summary:      string
  body:         string
  actionItems:  PlaudActionItem[]
  /** AI が見つけた関連先候補の固有名（取引先/案件/商談/物件など）。UI で検索・確定 */
  relatedName?: string
}

export type PlaudSegmentResult =
  | { ok: true; segments: PlaudSegment[] }
  | { ok: false; error: string }

export async function segmentPlaudByCase(markdown: string): Promise<PlaudSegmentResult> {
  try {
    await ensureFeature('plaud_import')
  } catch {
    return { ok: false, error: 'PLAUD 取り込みは有効化されていません。' }
  }
  if (!(await isAIFeatureEnabled())) {
    return { ok: false, error: 'AI 機能が無効です。案件分割には AI が必要です（単一案件としての取り込みは通常の PLAUD 取込をご利用ください）。' }
  }

  const text = (markdown ?? '').slice(0, MAX_LEN)
  if (!text.trim()) return { ok: false, error: 'ファイルが空です。' }

  try {
    await assertAiRateLimit()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'AI 利用制限に達しました。' }
  }

  const system = [
    'あなたは議事録（会議の文字起こし/要約）を「案件（取引・商談・プロジェクト等）」単位に分割するアシスタントです。',
    '1つの議事録に複数の案件の話題が含まれることがあります。話題の対象（取引先・物件・案件名など）が変わる境目で分割してください。',
    '出力は厳密な JSON のみ。前後に説明文を付けないこと。',
  ].join('\n')
  const user = [
    '次の議事録を案件ごとに分割してください。各セグメントに以下を付与:',
    '- title: その案件を表す短い名前（例: 「A社 新築案件」）',
    '- summary: その案件の要約（2〜4文）',
    '- body: その案件に関する本文の抜粋（原文ベース・改変しない）',
    '- action_items: [{ person, task, status }]（その案件のToDo。無ければ空配列）',
    '- related_name: 言及された取引先/案件/物件などの固有名（1つ・無ければ空文字）',
    '案件が1つだけなら segments は1要素。出力 JSON: {"segments":[{"title","summary","body","action_items":[{"person","task","status"}],"related_name"}]}',
    '---',
    text,
    '---',
  ].join('\n')

  let result
  try {
    result = await callAI({ system, user, maxTokens: 4000, temperature: 0.1, timeoutMs: 60000 })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'AI 呼び出しに失敗しました。' }
  }

  const parsed = extractJsonObject(result.text)
  const rawSegs = Array.isArray(parsed?.segments) ? parsed!.segments as Record<string, unknown>[] : []
  if (rawSegs.length === 0) return { ok: false, error: '案件を抽出できませんでした。テキストをご確認ください。' }

  const segments: PlaudSegment[] = rawSegs.map((s) => {
    const ai = Array.isArray(s.action_items) ? s.action_items as Record<string, unknown>[] : []
    return {
      title:   String(s.title ?? '').slice(0, 120) || '案件',
      summary: String(s.summary ?? ''),
      body:    String(s.body ?? ''),
      actionItems: ai.map((a) => ({
        person: String(a.person ?? ''),
        task:   String(a.task ?? ''),
        status: String(a.status ?? ''),
      })).filter((a) => a.task.trim()),
      relatedName: typeof s.related_name === 'string' && s.related_name.trim() ? s.related_name.trim() : undefined,
    }
  })

  return { ok: true, segments }
}

/**
 * 確認画面で確定した複数セグメントを、それぞれ独立した活動記録として作成する。
 * 各活動は任意の関連先（record_links ではなく activity_related_records junction）に紐づける。
 * 戻り値に作成件数と最初の活動 href を含める（UI が遷移に使う）。
 */
export type PlaudCreateSegment = {
  subject: string
  body:    string
  type?:   string
  related?: { object_api: string; record_id: string } | null
}

export async function createActivitiesFromPlaudSegments(
  segments: PlaudCreateSegment[],
): Promise<{ ok: true; created: number; firstHref: string | null } | { ok: false; error: string }> {
  try {
    await ensureFeature('plaud_import')
    await requirePermission('activities', 'create')
  } catch {
    return { ok: false, error: '活動を作成する権限がありません。' }
  }

  const owner_id = await getCurrentUserId()
  const valid = (segments ?? []).filter((s) => s.subject?.trim())
  if (valid.length === 0) return { ok: true, created: 0, firstHref: null }

  let firstId: string | null = null
  for (const seg of valid) {
    const [row] = await db.insert(activities).values({
      subject: seg.subject.trim().slice(0, 120),
      type:    seg.type || 'meeting',
      body:    seg.body?.trim() || null,
      occurred_at: new Date(),
      owner_id,
    }).returning({ id: activities.id })
    if (!firstId) firstId = row.id
    if (seg.related?.object_api && seg.related.record_id) {
      await db.insert(activity_related_records).values({
        activity_id:        row.id,
        related_object_api: seg.related.object_api,
        related_record_id:  seg.related.record_id,
      }).onConflictDoNothing()
    }
  }

  revalidatePath('/activities')
  return { ok: true, created: valid.length, firstHref: firstId ? `/activities/${firstId}` : null }
}

/** 確認画面で選択されたアクションアイテムを ToDo として作成する。 */
export async function createTasksFromPlaud(
  items: { task: string; person?: string }[],
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  try {
    await ensureFeature('plaud_import')
    await requirePermission('tasks', 'create')
  } catch {
    return { ok: false, error: 'ToDo を作成する権限がありません。' }
  }

  const rows = (items ?? [])
    .filter((i) => i.task?.trim())
    .map((i) => ({
      title: i.task.trim().slice(0, 200),
      description: i.person?.trim() ? `PLAUD取込 / 担当: ${i.person.trim()}` : 'PLAUD取込',
      priority: 'medium',
    }))

  if (rows.length === 0) return { ok: true, created: 0 }

  await db.insert(tasks).values(rows)
  revalidatePath('/tasks')
  return { ok: true, created: rows.length }
}
