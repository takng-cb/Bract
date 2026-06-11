/**
 * レコード承認 — サーバー側ヘルパー（REQ-0023 / ADR-0022 / #85）
 *
 * - ルール設定は system_settings の `approval_config:<book_api>`（JSON、parseApprovalConfig）。
 * - 申請インスタンスは approvals / approval_decisions（schema.ts）。
 * - ルール評価ロジックは approvalRules.ts（純関数）に分離。
 */
import 'server-only'
import { db } from '@/lib/db'
import { approvals, approval_decisions, expenses, system_settings, users, roles, object_definitions, custom_records } from '@/lib/schema'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import {
  parseApprovalConfig,
  findRoute,
  type ApprovalConfig,
  type ApprovalStep,
  type RecordValues,
} from '@/lib/approvalRules'

export const APPROVAL_CONFIG_KEY_PREFIX = 'approval_config:'

export type ApprovalRow = typeof approvals.$inferSelect
export type ApprovalDecisionRow = typeof approval_decisions.$inferSelect

/** ブックの承認設定を取得（未設定/不正は null） */
export async function getApprovalConfig(bookApi: string): Promise<ApprovalConfig | null> {
  const row = await db.select({ value: system_settings.value })
    .from(system_settings)
    .where(eq(system_settings.key, `${APPROVAL_CONFIG_KEY_PREFIX}${bookApi}`))
    .then((r) => r[0] ?? null)
  return parseApprovalConfig(row?.value)
}

/**
 * 承認のルール評価に使うレコード値を取得する。
 * Phase1 は typed の expenses ＋ 全カスタムブック（custom_records.data）に対応。
 * 他の typed ブックは Phase2 で追加する。
 */
export async function loadRecordValues(objectType: string, objectId: string): Promise<RecordValues | null> {
  if (objectType === 'expenses') {
    const r = await db.select({
      title: expenses.title, amount: expenses.amount,
      category: expenses.category, expense_date: expenses.expense_date,
      notes: expenses.notes,
    }).from(expenses).where(eq(expenses.id, objectId)).then((x) => x[0] ?? null)
    return r ?? null
  }
  // カスタムブック：data JSON をそのまま条件評価に使う
  const obj = await db.select({ id: object_definitions.id })
    .from(object_definitions)
    .where(eq(object_definitions.api_name, objectType))
    .then((r) => r[0] ?? null)
  if (!obj) return null
  const rec = await db.select({ data: custom_records.data })
    .from(custom_records)
    .where(and(eq(custom_records.id, objectId), eq(custom_records.object_id, obj.id)))
    .then((r) => r[0] ?? null)
  return (rec?.data as RecordValues | null) ?? null
}

/** 最新の承認申請（履歴含む）。無ければ null */
export async function getLatestApproval(objectType: string, objectId: string): Promise<{
  approval: ApprovalRow
  decisions: ApprovalDecisionRow[]
} | null> {
  const approval = await db.select().from(approvals)
    .where(and(eq(approvals.object_type, objectType), eq(approvals.object_id, objectId)))
    .orderBy(desc(approvals.requested_at))
    .limit(1)
    .then((r) => r[0] ?? null)
  if (!approval) return null
  const decisions = await db.select().from(approval_decisions)
    .where(eq(approval_decisions.approval_id, approval.id))
    .orderBy(approval_decisions.decided_at)
  return { approval, decisions }
}

/** 承認待ち（編集ロック対象）かどうか */
export async function hasPendingApproval(objectType: string, objectId: string): Promise<boolean> {
  const row = await db.select({ id: approvals.id }).from(approvals)
    .where(and(
      eq(approvals.object_type, objectType),
      eq(approvals.object_id, objectId),
      eq(approvals.status, 'pending'),
    ))
    .limit(1)
    .then((r) => r[0] ?? null)
  return !!row
}

/** route_snapshot を ApprovalStep[] として読み出す（不正なら空） */
export function routeFromSnapshot(snapshot: unknown): ApprovalStep[] {
  if (!Array.isArray(snapshot)) return []
  return snapshot.filter(
    (s): s is ApprovalStep => !!s && Array.isArray((s as ApprovalStep).approvers),
  )
}

/** レコードが承認対象（マッチするルートあり）か。対象なら steps を返す */
export async function resolveRoute(objectType: string, objectId: string): Promise<ApprovalStep[] | null> {
  const config = await getApprovalConfig(objectType)
  if (!config?.enabled) return null
  const record = await loadRecordValues(objectType, objectId)
  if (!record) return null
  return findRoute(config, record)
}

/** ユーザー id → 表示名（email）。承認パネルの履歴表示用 */
export async function getUserLabels(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return {}
  const rows = await db.select({ id: users.id, email: users.email })
    .from(users).where(inArray(users.id, unique))
  return Object.fromEntries(rows.map((r) => [r.id, r.email]))
}

/** approver エントリ（'user:<id>' | 'role:<name>'）の表示ラベル */
export function approverEntryLabel(entry: string, userLabels: Record<string, string>): string {
  if (entry.startsWith('user:')) return userLabels[entry.slice(5)] ?? 'ユーザー'
  if (entry.startsWith('role:')) return `ロール「${entry.slice(5)}」`
  return entry
}

/** route 内の user: エントリの id をすべて集める（ラベル解決用） */
export function userIdsInRoute(steps: ApprovalStep[]): string[] {
  return steps.flatMap((s) => s.approvers.filter((a) => a.startsWith('user:')).map((a) => a.slice(5)))
}

/** 承認設定エディタ用：承認者に指定できるユーザー/ロールの一覧 */
export async function getApprovalAdminData(): Promise<{
  users: { id: string; email: string }[]
  roles: string[]
}> {
  const [userRows, roleRows] = await Promise.all([
    db.select({ id: users.id, email: users.email }).from(users).orderBy(asc(users.email)),
    db.select({ name: roles.name }).from(roles).orderBy(asc(roles.name)).catch(() => [] as { name: string }[]),
  ])
  const roleNames = roleRows.length ? roleRows.map((r) => r.name) : ['admin', 'editor', 'viewer']
  return { users: userRows, roles: roleNames }
}
