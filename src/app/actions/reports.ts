'use server'

/**
 * 業務報告（#88 Phase 1 / ADR-0025 / REQ-0072）
 *
 * 案件（assignments）・商談（opportunities）に紐づく活動・ToDo を期間で集約し、
 * 選択したテンプレート書式で AI 要約レポートを生成する（その場生成＋コピー）。
 *
 * 方針:
 *   - draft-then-apply（CLAUDE.md / ADR-0004）: 生成は読み取り専用。DB へは書かない。
 *   - 既存 summarizeActivitiesAndTasks を流用し、systemPrompt をテンプレ body に差し替えるだけ。
 *   - テンプレは個人＋全員共有の 2 層。共有（owner_id=NULL）の作成・削除は admin のみ。
 *   - テンプレ 0 件でも DEFAULT_REPORT_PROMPT で動く（report_templates は任意）。
 */
import { requireEditor, isAdmin, getCurrentUserId } from '@/lib/auth'
import { db } from '@/lib/db'
import { report_templates } from '@/lib/schema'
import { eq, or, isNull, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { summarizeActivitiesAndTasks, type SummarizationResult } from '@/lib/ai/summarize'
import { ensureAIFeatureEnabled, AIFeatureDisabledError } from '@/lib/ai/featureFlag'
import { AIDisabledError, AIProviderError } from '@/lib/ai/types'

/** 報告対象として許可するブック（ADR-0025: 案件＋商談から開始） */
const REPORT_TARGETS: Record<string, { label: string; junctionApi: string }> = {
  // UI 上の対象キー → 表示名 ＋ activity_related_records.related_object_api の値
  opportunity: { label: '商談', junctionApi: 'opportunity' },
  assignment:  { label: '案件', junctionApi: 'assignment' },
}

/** テンプレ未保存でも使える標準テンプレ（フォールバック）。
 *  'use server' ファイルは async 関数しか export できないため module-private に保つ
 *  （export するとランタイムで "can only export async functions" となりページが 500）。 */
const DEFAULT_REPORT_PROMPT = `あなたは業務報告を作成するアシスタントです。
以下に対象（案件・商談）に紐づく活動（打合せ・電話・現場対応等）と ToDo を期間で抽出したリストを与えます。
これを基に、報告書として次の構成でまとめてください:

1. 対応サマリー（この期間の主な動きを時系列で簡潔に）
2. 現状・先方の状況（読み取れる範囲で）
3. 次のアクション（既存 ToDo ＋ 推奨される追加対応）
4. 共有事項・留意点（あれば）

日本語で、そのまま報告に使える丁寧な文体で。冗長にせず要点を箇条書き中心に。`

export type ReportTemplate = {
  id: string
  name: string
  body: string
  shared: boolean
  editable: boolean   // 現ユーザーが削除/編集できるか
}

/**
 * 現ユーザーが使えるテンプレ一覧（自分のもの＋全員共有）。
 * 先頭に常に「標準」（DEFAULT_REPORT_PROMPT・id='__default__'）を含める。
 */
export async function listReportTemplates(): Promise<ReportTemplate[]> {
  await requireEditor()
  const [uid, admin] = await Promise.all([getCurrentUserId(), isAdmin()])
  const rows = uid
    ? await db.select().from(report_templates)
        .where(or(isNull(report_templates.owner_id), eq(report_templates.owner_id, uid)))
        .orderBy(asc(report_templates.name))
    : await db.select().from(report_templates)
        .where(isNull(report_templates.owner_id))
        .orderBy(asc(report_templates.name))

  const custom: ReportTemplate[] = rows.map((r) => {
    const shared = r.owner_id == null
    return {
      id: r.id,
      name: shared ? `${r.name}（共有）` : r.name,
      body: r.body,
      shared,
      editable: shared ? admin : r.owner_id === uid,
    }
  })

  return [
    { id: '__default__', name: '標準', body: DEFAULT_REPORT_PROMPT, shared: true, editable: false },
    ...custom,
  ]
}

/** テンプレを作成（共有テンプレは admin のみ）。 */
export async function createReportTemplate(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireEditor()
  const name = (formData.get('name') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const shared = formData.get('shared') === 'on' || formData.get('shared') === 'true'
  if (!name) return { ok: false, error: 'テンプレート名を入力してください' }
  if (!body) return { ok: false, error: '書式（本文）を入力してください' }

  const uid = await getCurrentUserId()
  if (shared && !(await isAdmin())) {
    return { ok: false, error: '全員共有テンプレートの作成は管理者のみ可能です' }
  }
  await db.insert(report_templates).values({ name, body, owner_id: shared ? null : uid })
  revalidatePath('/settings')
  return { ok: true }
}

/** テンプレを削除（自分のもの。共有は admin のみ）。 */
export async function deleteReportTemplate(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireEditor()
  const [uid, admin] = await Promise.all([getCurrentUserId(), isAdmin()])
  const [row] = await db.select().from(report_templates).where(eq(report_templates.id, id)).limit(1)
  if (!row) return { ok: false, error: 'テンプレートが見つかりません' }
  const shared = row.owner_id == null
  if (shared ? !admin : row.owner_id !== uid) {
    return { ok: false, error: 'このテンプレートを削除する権限がありません' }
  }
  await db.delete(report_templates).where(eq(report_templates.id, id))
  revalidatePath('/settings')
  return { ok: true }
}

type ReportResponse =
  | { ok: true; result: SummarizationResult }
  | { ok: false; error: string }

/**
 * 報告レポートを生成する（その場生成・保存なし）。
 * targetApi: 'opportunity' | 'assignment'、templateId: テンプレ id（'__default__' で標準）。
 */
export async function generateReport(
  targetApi: string,
  recordId: string,
  from: string,
  to: string,
  templateId: string,
): Promise<ReportResponse> {
  await requireEditor()

  const target = REPORT_TARGETS[targetApi]
  if (!target) return { ok: false, error: '対応していない報告対象です' }

  // テンプレ body を解決（標準 or 保存済みの可視テンプレに限る）
  let systemPrompt = DEFAULT_REPORT_PROMPT
  if (templateId && templateId !== '__default__') {
    const templates = await listReportTemplates()
    const t = templates.find((x) => x.id === templateId)
    if (!t) return { ok: false, error: '選択したテンプレートが見つかりません' }
    systemPrompt = t.body
  }

  try {
    await ensureAIFeatureEnabled()
    const result = await summarizeActivitiesAndTasks({
      objectApi: target.junctionApi,
      recordId,
      from,
      to,
      systemPrompt,
    })
    return { ok: true, result }
  } catch (e) {
    if (e instanceof AIFeatureDisabledError) return { ok: false, error: e.message }
    if (e instanceof AIDisabledError) return { ok: false, error: e.message }
    if (e instanceof AIProviderError) {
      return { ok: false, error: `${e.provider} API エラー${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}: ${e.message}` }
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
