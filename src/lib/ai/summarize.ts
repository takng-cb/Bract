/**
 * 活動 (activities) と ToDo (tasks) を期間で抽出し、AI に渡せる形に整形 + 要約する。
 *
 * 共通ロジック（商談・物件・将来の他オブジェクトでも使えるよう汎用化）。
 *
 * 仕組み:
 *   1. junction (activity_related_records / task_related_records) で
 *      object_api + record_id に紐づく ID を取得
 *   2. 期間 (from〜to) で activities / tasks を絞り込み
 *   3. プレーンテキストにフォーマット
 *   4. callAI で要約
 */
import { db } from '@/lib/db'
import { activities, tasks } from '@/lib/schema'
import {
  activityIdsRelatedTo, taskIdsRelatedTo,
} from '@/lib/relatedRecords'
import { and, gte, lte, inArray, asc } from 'drizzle-orm'
import { callAI } from './client'
import { getAIConfig } from './config'
import { getActivityTypes } from '@/lib/activityTypes'

export type SummarizationInput = {
  /** 対象オブジェクト API 名（例: 'opportunity', 'property'） */
  objectApi: string
  /** 対象レコード ID */
  recordId: string
  /** 期間開始 (ISO date: 'YYYY-MM-DD') */
  from: string
  /** 期間終了 (ISO date: 'YYYY-MM-DD'、含む) */
  to: string
  /** AI に渡すシステムプロンプト */
  systemPrompt: string
}

export type SummarizationResult = {
  summary: string
  /** AI に渡したコンテキスト（デバッグ用） */
  contextText: string
  /** 検出した活動の数 */
  activityCount: number
  /** 検出した ToDo の数 */
  taskCount: number
  /** 使用したプロバイダとモデル */
  meta: {
    provider: string
    model:    string
  }
}

/**
 * 活動 + ToDo を 1 つの文字列にまとめる。
 * AI の入力 token 数を抑えるため、長い本文は切り詰める。
 */
const MAX_BODY_LEN = 500
const truncate = (s: string | null | undefined) =>
  !s ? '' : s.length > MAX_BODY_LEN ? s.slice(0, MAX_BODY_LEN) + ' …(以下省略)' : s

function formatDateJP(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

/**
 * 関連活動・タスクを期間で抽出してフォーマット。
 * 内部用 (export はテストで使う可能性があるため named export)。
 */
export async function buildSummarizationContext(input: SummarizationInput): Promise<{
  text: string
  activityCount: number
  taskCount: number
}> {
  const { objectApi, recordId, from, to } = input

  // 1. junction 経由で ID を取得
  const fromDateStart = `${from}T00:00:00`
  const toDateEnd     = `${to}T23:59:59`

  const [activityList, taskList, activityTypes] = await Promise.all([
    db.select({
      id:          activities.id,
      type:        activities.type,
      subject:     activities.subject,
      body:        activities.body,
      occurred_at: activities.occurred_at,
    })
      .from(activities)
      .where(and(
        inArray(activities.id, activityIdsRelatedTo(objectApi, recordId)),
        gte(activities.occurred_at, new Date(fromDateStart)),
        lte(activities.occurred_at, new Date(toDateEnd)),
      ))
      .orderBy(asc(activities.occurred_at)),
    db.select({
      id:          tasks.id,
      title:       tasks.title,
      description: tasks.description,
      done:        tasks.done,
      due_date:    tasks.due_date,
      priority:    tasks.priority,
    })
      .from(tasks)
      .where(and(
        inArray(tasks.id, taskIdsRelatedTo(objectApi, recordId)),
        // ToDo は due_date / created_at どちらかが期間内（due_date 優先）
        // ここでは due_date が期間内 OR 期間中に未完了で残っているものを含めるため
        // 期間に被るかを単純に due_date のみで判定（NULL は対象外）
        // 期間内に紐付いた全件を取るアプローチも検討するが、まずは due_date 基準
        gte(tasks.due_date, from),
        lte(tasks.due_date, to),
      ))
      .orderBy(asc(tasks.due_date)),
    getActivityTypes(),
  ])

  const typeLabels: Record<string, string> = {}
  for (const t of activityTypes) typeLabels[t.value] = `${t.icon} ${t.label}`

  const lines: string[] = []
  lines.push(`# 期間: ${from} 〜 ${to}`)

  // 活動セクション
  lines.push('')
  lines.push(`## 活動 (${activityList.length} 件)`)
  if (activityList.length === 0) {
    lines.push('（この期間内に紐づく活動はありません）')
  } else {
    for (const a of activityList) {
      const dateStr = a.occurred_at
        ? formatDateJP(a.occurred_at) + ' ' + new Date(a.occurred_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : '—'
      lines.push(``)
      lines.push(`### ${dateStr} ${typeLabels[a.type] ?? a.type}`)
      lines.push(`件名: ${a.subject}`)
      if (a.body) lines.push(`内容: ${truncate(a.body)}`)
    }
  }

  // ToDo セクション
  lines.push('')
  lines.push(`## ToDo (${taskList.length} 件)`)
  if (taskList.length === 0) {
    lines.push('（この期間内に期限のある ToDo はありません）')
  } else {
    for (const t of taskList) {
      const statusLabel = t.done ? '✅ 完了' : '⏳ 未完了'
      const priorityLabel = t.priority === 'high' ? '🔴高' : t.priority === 'low' ? '🟢低' : '🟡中'
      lines.push(``)
      lines.push(`- [${statusLabel}] [${priorityLabel}] 期限 ${t.due_date ?? '—'}: ${t.title}`)
      if (t.description) lines.push(`  メモ: ${truncate(t.description)}`)
    }
  }

  return {
    text: lines.join('\n'),
    activityCount: activityList.length,
    taskCount: taskList.length,
  }
}

/**
 * AI を呼んで要約を取得するメイン関数。
 * - データが空（活動 0 + ToDo 0）なら AI を呼ばずに固定文を返す（コスト/レート節約）
 */
export async function summarizeActivitiesAndTasks(input: SummarizationInput): Promise<SummarizationResult> {
  const ctx = await buildSummarizationContext(input)

  if (ctx.activityCount === 0 && ctx.taskCount === 0) {
    const cfg = await getAIConfig()
    return {
      summary: 'この期間内に紐づく活動および ToDo はありませんでした。',
      contextText:   ctx.text,
      activityCount: 0,
      taskCount:     0,
      meta: { provider: cfg.provider ?? '(未設定)', model: cfg.model || '(未設定)' },
    }
  }

  const result = await callAI({
    system:      input.systemPrompt,
    user:        ctx.text,
    maxTokens:   1024,
    temperature: 0.3,
  })

  return {
    summary:       result.text,
    contextText:   ctx.text,
    activityCount: ctx.activityCount,
    taskCount:     ctx.taskCount,
    meta: { provider: result.provider, model: result.model },
  }
}
