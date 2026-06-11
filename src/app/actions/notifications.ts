'use server'

/**
 * 通知ベル（REQ-0040・既読タイムスタンプ方式）
 *
 * notifications テーブルは作らず、ベルを開くたびに「いま対応すべきもの」をその場で集計する:
 *   1. 自分が承認すべき承認待ち（現在 step の承認者に自分が含まれ、未判定のもの）
 *   2. 期限超過・今日期限の未完了 ToDo（自分の担当 or 担当未設定）
 * 赤ドットは user_preferences.notifications_seen_at（最後にベルを開いた時刻）より
 * 新しい項目がある場合のみ点灯。ベルを開いたら markNotificationsSeen で全既読。
 */
import { db } from '@/lib/db'
import { approvals, approval_decisions, tasks, user_preferences } from '@/lib/schema'
import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm'
import { getCurrentUserId } from '@/lib/auth'
import { getCurrentPermissions } from '@/lib/permissions'
import { loadRecordValues, routeFromSnapshot } from '@/lib/approvals'
import { canDecideStep } from '@/lib/approvalRules'
import { APPROVAL_BOOK_META } from '@/lib/approvalBookMeta'

export type NotificationItem = {
  kind: 'approval' | 'task'
  label: string
  sub?: string
  href: string
  /** 新着判定に使う時刻（ISO） */
  at: string
}

export type NotificationsResult = {
  items: NotificationItem[]
  /** notifications_seen_at より新しい項目数（赤ドット用） */
  unseenCount: number
}

const BOOK_HREF: Record<string, string> = {
  accounts: '/accounts/', contacts: '/contacts/', opportunities: '/opportunities/',
  expenses: '/expenses/', products: '/products/', warehouses: '/warehouses/',
  vehicles: '/vehicles/', customer_vehicles: '/customer-vehicles/', parts: '/parts/',
  maintenance_records: '/maintenance/', staff: '/staff/', assignments: '/assignments/',
  properties: '/properties/',
}
const bookHref = (api: string, id: string) => `${BOOK_HREF[api] ?? `/books/${api}/`}${id}`
const BOOK_LABEL = new Map(APPROVAL_BOOK_META.map((m) => [m.api, m.label]))

/** レコード値から人が読める名前を推定（承認通知のラベル用） */
function recordName(values: Record<string, unknown> | null): string | null {
  if (!values) return null
  for (const key of ['name', 'title', 'maintenance_no', 'assignment_no', 'plate_number', 'full_name']) {
    const v = values[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

export async function fetchNotifications(): Promise<NotificationsResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { items: [], unseenCount: 0 }
  const perms = await getCurrentPermissions()

  const [pref, pendingApprovals] = await Promise.all([
    db.select({ seen: user_preferences.notifications_seen_at })
      .from(user_preferences).where(eq(user_preferences.user_id, userId))
      .then((r) => r[0] ?? null),
    db.select().from(approvals).where(eq(approvals.status, 'pending'))
      .orderBy(asc(approvals.requested_at)),
  ])

  // ── 1. 自分が承認すべき承認待ち ──────────────────────────────
  const decisionsByApproval = new Map<string, { step: number; approver_id: string; decision: string }[]>()
  if (pendingApprovals.length > 0) {
    const decRows = await db.select({
      approval_id: approval_decisions.approval_id,
      step: approval_decisions.step,
      approver_id: approval_decisions.approver_id,
      decision: approval_decisions.decision,
    }).from(approval_decisions)
      .where(inArray(approval_decisions.approval_id, pendingApprovals.map((a) => a.id)))
    for (const d of decRows) {
      if (!decisionsByApproval.has(d.approval_id)) decisionsByApproval.set(d.approval_id, [])
      decisionsByApproval.get(d.approval_id)!.push(d)
    }
  }

  const items: NotificationItem[] = []
  for (const a of pendingApprovals) {
    const route = routeFromSnapshot(a.route_snapshot)
    const step = route[a.current_step - 1]
    if (!step) continue
    const decisions = decisionsByApproval.get(a.id) ?? []
    if (!canDecideStep(step, a.current_step, decisions, userId, perms.roleName)) continue

    const values = await loadRecordValues(a.object_type, a.object_id)
    const name = recordName(values)
    const bookLabel = BOOK_LABEL.get(a.object_type) ?? a.object_type
    items.push({
      kind: 'approval',
      label: `承認依頼: ${name ?? bookLabel}`,
      sub: `${bookLabel} · ${a.current_step}/${route.length} 段階目`,
      href: bookHref(a.object_type, a.object_id),
      at: (a.requested_at ?? new Date()).toISOString(),
    })
  }

  // ── 2. 期限超過・今日期限の未完了 ToDo（自分の担当 or 担当未設定）──
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const dueTasks = await db.select({
    id: tasks.id, title: tasks.title, due_date: tasks.due_date, owner_id: tasks.owner_id,
  }).from(tasks)
    .where(and(
      eq(tasks.done, false),
      lte(tasks.due_date, today),
      or(eq(tasks.owner_id, userId), isNull(tasks.owner_id)),
    ))
    .orderBy(asc(tasks.due_date))
    .limit(20)

  for (const t of dueTasks) {
    const overdue = String(t.due_date) < today
    items.push({
      kind: 'task',
      label: t.title,
      sub: overdue ? `期限超過（${t.due_date}）` : '今日が期限',
      href: `/tasks/${t.id}`,
      at: new Date(`${t.due_date}T00:00:00+09:00`).toISOString(),
    })
  }

  const seen = pref?.seen ? new Date(pref.seen).getTime() : 0
  const unseenCount = items.filter((i) => new Date(i.at).getTime() > seen).length
  return { items, unseenCount }
}

/** ベルを開いた＝全既読（notifications_seen_at を現在時刻に） */
export async function markNotificationsSeen(): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) return
  await db.insert(user_preferences)
    .values({ user_id: userId, notifications_seen_at: new Date() })
    .onConflictDoUpdate({
      target: user_preferences.user_id,
      set:    { notifications_seen_at: new Date(), updated_at: new Date() },
    })
}
