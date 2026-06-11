/**
 * レコード承認 — サーバー側ヘルパー（REQ-0023 / ADR-0022 / #85）
 *
 * - ルール設定は system_settings の `approval_config:<book_api>`（JSON、parseApprovalConfig）。
 * - 申請インスタンスは approvals / approval_decisions（schema.ts）。
 * - ルール評価ロジックは approvalRules.ts（純関数）に分離。
 */
import 'server-only'
import { db } from '@/lib/db'
import {
  approvals, approval_decisions, system_settings, users, roles, object_definitions, custom_records,
  accounts, contacts, opportunities, expenses, products, warehouses,
  vehicles, customer_vehicles, parts, maintenance_records, staff, assignments,
} from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { and, asc, desc, eq, getTableColumns, inArray, like } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import {
  parseApprovalConfig,
  findRoute,
  type ApprovalConfig,
  type ApprovalStep,
  type RecordValues,
} from '@/lib/approvalRules'
import { APPROVAL_BOOK_META } from '@/lib/approvalBookMeta'
import { logChanges } from '@/lib/changeLog'

/** 承認を設定できる typed ブック → テーブル */
const TABLE_BY_API: Record<string, PgTable> = {
  accounts, contacts, opportunities, expenses, products, warehouses,
  vehicles, customer_vehicles, parts, maintenance_records, staff, assignments, properties,
}

/** change_logs の object_type（既存の履歴表記に合わせた単数形） */
const LOG_TYPE_BY_API: Record<string, string> = {
  accounts: 'account', contacts: 'contact', opportunities: 'opportunity', expenses: 'expense',
  products: 'product', warehouses: 'warehouse', vehicles: 'vehicle', customer_vehicles: 'customer_vehicle',
  parts: 'part', maintenance_records: 'maintenance', staff: 'staff', assignments: 'assignment',
  properties: 'property',
}

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

/** typed テーブルの id カラム（全 typed テーブルが uuid 'id' を持つ前提） */
function idColumn(table: PgTable) {
  return getTableColumns(table).id
}

/**
 * 承認のルール評価に使うレコード値を取得する。
 * 全 typed ブック（TABLE_BY_API）＋全カスタムブック（custom_records.data）に対応。
 */
export async function loadRecordValues(objectType: string, objectId: string): Promise<RecordValues | null> {
  const table = TABLE_BY_API[objectType]
  if (table) {
    const r = await db.select().from(table).where(eq(idColumn(table), objectId)).then((x) => x[0] ?? null)
    return (r as RecordValues | null) ?? null
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

/**
 * 単一フィールドの変更を適用する（承認完了時の遷移反映／承認不要時の直接変更）。
 * typed ブック：UPDATE ＋ change_logs。カスタムブック：data JSON を read-modify-write。
 */
export async function applyFieldChange(
  objectType: string,
  objectId: string,
  field: string,
  value: string,
  beforeValue: string | null,
): Promise<void> {
  const fieldLabel = field === 'stage' ? 'ステージ' : field === 'status' ? 'ステータス' : field
  const table = TABLE_BY_API[objectType]
  if (table) {
    const cols = getTableColumns(table)
    if (!cols[field]) throw new Error(`フィールド ${field} は ${objectType} に存在しません`)
    const set: Record<string, unknown> = { [field]: value }
    if (cols.updated_at) set.updated_at = new Date()
    await db.update(table).set(set).where(eq(idColumn(table), objectId))
  } else {
    const obj = await db.select({ id: object_definitions.id })
      .from(object_definitions).where(eq(object_definitions.api_name, objectType))
      .then((r) => r[0] ?? null)
    if (!obj) throw new Error(`ブック ${objectType} が見つかりません`)
    const rec = await db.select({ data: custom_records.data })
      .from(custom_records)
      .where(and(eq(custom_records.id, objectId), eq(custom_records.object_id, obj.id)))
      .then((r) => r[0] ?? null)
    if (!rec) throw new Error('レコードが見つかりません')
    const data = { ...(rec.data as Record<string, unknown> ?? {}), [field]: value }
    await db.update(custom_records)
      .set({ data, updated_at: new Date() })
      .where(eq(custom_records.id, objectId))
  }
  await logChanges(LOG_TYPE_BY_API[objectType] ?? objectType, objectId,
    { [field]: { label: fieldLabel, value: beforeValue } },
    { [field]: { label: fieldLabel, value } })
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

/** book api → 詳細ページ URL（承認一覧・通知ベルで共用） */
const BOOK_HREF: Record<string, string> = {
  accounts: '/accounts/', contacts: '/contacts/', opportunities: '/opportunities/',
  expenses: '/expenses/', products: '/products/', warehouses: '/warehouses/',
  vehicles: '/vehicles/', customer_vehicles: '/customer-vehicles/', parts: '/parts/',
  maintenance_records: '/maintenance/', staff: '/staff/', assignments: '/assignments/',
  properties: '/properties/',
}
export function bookRecordHref(api: string, id: string): string {
  return `${BOOK_HREF[api] ?? `/objects/${api}/`}${id}`
}

const BOOK_LABEL = new Map(APPROVAL_BOOK_META.map((m) => [m.api, m.label]))
export function bookLabelOf(api: string): string {
  return BOOK_LABEL.get(api) ?? api
}

/** レコード値から人が読める名前を推定（承認の表示用） */
export function recordDisplayName(values: RecordValues | null): string | null {
  if (!values) return null
  for (const key of ['name', 'title', 'maintenance_no', 'assignment_no', 'plate_number', 'full_name']) {
    const v = values[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

export type ApprovalListItem = {
  approvalId: string
  objectType: string
  bookLabel: string
  recordLabel: string
  href: string
  status: string
  currentStep: number
  totalSteps: number
  requestedBy: string
  requestedAt: string  // ISO
  transition: { from?: string; to?: string } | null
}

/**
 * 承認一覧（#85 Phase3）:
 *   toDecide … 自分が現在 step の承認者で未判定の承認待ち
 *   mine     … 自分が申請したもの（承認待ち＋直近の処理済み）
 */
export async function listApprovalsForUser(userId: string, roleName: string): Promise<{
  toDecide: ApprovalListItem[]
  mine: ApprovalListItem[]
}> {
  const { canDecideStep } = await import('@/lib/approvalRules')
  const rows = await db.select().from(approvals)
    .orderBy(desc(approvals.requested_at))
    .limit(200)

  const pendingIds = rows.filter((r) => r.status === 'pending').map((r) => r.id)
  const decRows = pendingIds.length
    ? await db.select({
        approval_id: approval_decisions.approval_id,
        step: approval_decisions.step,
        approver_id: approval_decisions.approver_id,
        decision: approval_decisions.decision,
      }).from(approval_decisions).where(inArray(approval_decisions.approval_id, pendingIds))
    : []
  const decByApproval = new Map<string, { step: number; approver_id: string; decision: string }[]>()
  for (const d of decRows) {
    if (!decByApproval.has(d.approval_id)) decByApproval.set(d.approval_id, [])
    decByApproval.get(d.approval_id)!.push(d)
  }

  const toItem = async (a: typeof rows[number]): Promise<ApprovalListItem> => {
    const route = routeFromSnapshot(a.route_snapshot)
    const values = await loadRecordValues(a.object_type, a.object_id)
    const t = a.transition as { from?: string; to?: string } | null
    return {
      approvalId: a.id,
      objectType: a.object_type,
      bookLabel: bookLabelOf(a.object_type),
      recordLabel: recordDisplayName(values) ?? `#${a.object_id.slice(0, 8)}`,
      href: bookRecordHref(a.object_type, a.object_id),
      status: a.status,
      currentStep: a.current_step,
      totalSteps: route.length,
      requestedBy: a.requested_by,
      requestedAt: (a.requested_at ?? new Date()).toISOString(),
      transition: t?.to !== undefined || t?.from !== undefined ? { from: t?.from, to: t?.to } : null,
    }
  }

  const toDecide: ApprovalListItem[] = []
  for (const a of rows) {
    if (a.status !== 'pending') continue
    const route = routeFromSnapshot(a.route_snapshot)
    const step = route[a.current_step - 1]
    if (!step) continue
    if (canDecideStep(step, a.current_step, decByApproval.get(a.id) ?? [], userId, roleName)) {
      toDecide.push(await toItem(a))
    }
  }

  const mineRows = rows.filter((a) => a.requested_by === userId)
  const mine: ApprovalListItem[] = []
  for (const a of mineRows.slice(0, 30)) mine.push(await toItem(a))

  return { toDecide, mine }
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

/** 承認設定エディタ用：設定可能な全ブック（typed メタ＋カスタムブック） */
export async function getApprovalBooks(): Promise<ApprovalBookMetaResolved[]> {
  const typedApis = new Set(APPROVAL_BOOK_META.map((m) => m.api))
  const customs = await db.select({
    api_name: object_definitions.api_name, label_plural: object_definitions.label_plural,
  }).from(object_definitions)
    .where(eq(object_definitions.is_builtin, false))
    .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label_plural))
  return [
    ...APPROVAL_BOOK_META,
    ...customs
      .filter((c) => !typedApis.has(c.api_name))
      .map((c) => ({
        api: c.api_name, label: c.label_plural,
        statusField: 'status', statusOptions: [], conditionFields: [],
      })),
  ]
}
export type ApprovalBookMetaResolved = (typeof APPROVAL_BOOK_META)[number]

/** 全ブックの承認設定をまとめて取得（設定エディタ用）。key = book api */
export async function getApprovalConfigs(): Promise<Record<string, ApprovalConfig>> {
  const rows = await db.select({ key: system_settings.key, value: system_settings.value })
    .from(system_settings)
    .where(like(system_settings.key, `${APPROVAL_CONFIG_KEY_PREFIX}%`))
  const out: Record<string, ApprovalConfig> = {}
  for (const r of rows) {
    const config = parseApprovalConfig(r.value)
    if (config) out[r.key.slice(APPROVAL_CONFIG_KEY_PREFIX.length)] = config
  }
  return out
}
