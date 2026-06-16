export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, activities, tasks, task_related_records, activity_related_records } from '@/lib/schema'
import { eq, desc, asc, and, inArray } from 'drizzle-orm'
import Link from 'next/link'
import PeriodSelector from '@/components/PeriodSelector'
import { formatDateLocal, todayLocal, lastOfMonth } from '@/lib/dateUtils'
import { getActivityTypes } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'
import { ShieldAlert, ArrowRight } from 'lucide-react'
import { getCurrentUserId } from '@/lib/auth'
import { getCurrentPermissions } from '@/lib/permissions'
import { listApprovalsForUser, getUserLabels } from '@/lib/approvals'
import { decideApproval } from '@/app/actions/approvals'
import { getAppTimeZone } from '@/lib/systemSettings'
import { fmtDate } from '@/lib/datetime'

// 色は semantic tone トークンで統一（ADR-0021）
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'bg-danger-bg text-danger' },
  medium: { label: '中', color: 'bg-warning-bg text-warning' },
  low:    { label: '低', color: 'bg-n-100 text-n-600' },
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  prospecting:   { label: '見込み',   color: 'bg-n-100 text-n-600' },
  qualification: { label: '要件確認', color: 'bg-info-bg text-info' },
  proposal:      { label: '提案',     color: 'bg-ai-bg text-ai' },
  negotiation:   { label: '交渉',     color: 'bg-warning-bg text-warning' },
  closed_won:    { label: '受注',     color: 'bg-positive-bg text-positive' },
  closed_lost:   { label: '失注',     color: 'bg-n-100 text-n-600' },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const tz = await getAppTimeZone()
  const now = new Date()
  // 既定期間: 今月（ローカルタイムの月初〜月末）
  const year      = now.getFullYear()
  const month     = now.getMonth() + 1
  const monthFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const monthTo   = lastOfMonth(year, month)
  const from = sp.from || monthFrom
  const to   = sp.to   || monthTo
  const today = todayLocal()

  // 動的活動種別（admin/objects で編集可能）
  const activityTypes = await getActivityTypes()
  const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {}
  for (const t of activityTypes) {
    ACTIVITY_TYPE_CONFIG[t.value] = {
      label: t.label,
      icon:  t.icon,
      color: t.color ?? 'bg-zinc-50 text-zinc-700',
    }
  }

  const [
    pendingTasks,
    recentAccounts,
    recentContacts,
    recentOpportunities,
    allActivities,
  ] = await Promise.all([
    // tasks 単体を取得（関連は junction 経由で後段で attach）
    db.select({
      id: tasks.id, title: tasks.title, done: tasks.done,
      priority: tasks.priority, due_date: tasks.due_date,
    })
      .from(tasks)
      .where(eq(tasks.done, false))
      .orderBy(asc(tasks.due_date)),
    db.select({ id: accounts.id, name: accounts.name, industry: accounts.industry, updated_at: accounts.updated_at })
      .from(accounts).orderBy(desc(accounts.updated_at)).limit(4),
    db.select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title, updated_at: contacts.updated_at })
      .from(contacts).orderBy(desc(contacts.updated_at)).limit(4),
    db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage, updated_at: opportunities.updated_at })
      .from(opportunities).orderBy(desc(opportunities.updated_at)).limit(4),
    // activities 単体（関連は junction 経由で後段で attach）
    db.select({
      id: activities.id, type: activities.type, subject: activities.subject,
      occurred_at: activities.occurred_at,
    })
      .from(activities)
      .orderBy(desc(activities.occurred_at)),
  ])

  // ── junction 経由で関連 account/opportunity を取得 ──────────────────────
  // 表示で実際に必要な範囲（期間内に絞る前）にバッチ問い合わせ
  const taskIds     = pendingTasks.map((t) => t.id)
  const activityIds = allActivities.map((a) => a.id)

  const [taskRelRows, activityRelRows] = await Promise.all([
    taskIds.length > 0
      ? db.select({
          host_id: task_related_records.task_id,
          api:     task_related_records.related_object_api,
          rec_id:  task_related_records.related_record_id,
        })
          .from(task_related_records)
          .where(and(
            inArray(task_related_records.task_id, taskIds),
            inArray(task_related_records.related_object_api, ['account', 'opportunity']),
          ))
      : Promise.resolve([]),
    activityIds.length > 0
      ? db.select({
          host_id: activity_related_records.activity_id,
          api:     activity_related_records.related_object_api,
          rec_id:  activity_related_records.related_record_id,
        })
          .from(activity_related_records)
          .where(and(
            inArray(activity_related_records.activity_id, activityIds),
            eq(activity_related_records.related_object_api, 'account'),
          ))
      : Promise.resolve([]),
  ])

  const refAccountIds     = [...new Set([...taskRelRows, ...activityRelRows].filter((r) => r.api === 'account').map((r) => r.rec_id))]
  const refOpportunityIds = [...new Set(taskRelRows.filter((r) => r.api === 'opportunity').map((r) => r.rec_id))]
  const [refAccountRows, refOpportunityRows] = await Promise.all([
    refAccountIds.length > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, refAccountIds))
      : Promise.resolve([]),
    refOpportunityIds.length > 0
      ? db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities).where(inArray(opportunities.id, refOpportunityIds))
      : Promise.resolve([]),
  ])
  const accountNameById     = new Map(refAccountRows.map((r) => [r.id, r.name]))
  const opportunityNameById = new Map(refOpportunityRows.map((r) => [r.id, r.name]))

  /** 行に「関連 account / opportunity 名一覧」を attach */
  const taskById     = new Map<string, { accounts: { id: string; name: string }[]; opportunities: { id: string; name: string }[] }>()
  for (const r of taskRelRows) {
    if (!taskById.has(r.host_id)) taskById.set(r.host_id, { accounts: [], opportunities: [] })
    const e = taskById.get(r.host_id)!
    if (r.api === 'account')     e.accounts.push({ id: r.rec_id, name: accountNameById.get(r.rec_id) ?? '—' })
    if (r.api === 'opportunity') e.opportunities.push({ id: r.rec_id, name: opportunityNameById.get(r.rec_id) ?? '—' })
  }
  const activityById = new Map<string, { accounts: { id: string; name: string }[] }>()
  for (const r of activityRelRows) {
    if (!activityById.has(r.host_id)) activityById.set(r.host_id, { accounts: [] })
    activityById.get(r.host_id)!.accounts.push({ id: r.rec_id, name: accountNameById.get(r.rec_id) ?? '—' })
  }

  // 直近のやること：期限超過 ＋ 今後7日以内（期間に依存しない・ホームの主役）
  const weekAhead = (() => { const d = new Date(today); d.setDate(d.getDate() + 7); return formatDateLocal(d) })()
  const imminentTasks = pendingTasks
    .filter((t) => t.due_date && t.due_date <= weekAhead)
    .slice(0, 12)
  const overdueCount = imminentTasks.filter((t) => t.due_date && t.due_date < today).length

  // 期間内の活動（occurred_at で絞る、ローカルタイムの日付で比較）
  const periodActivities = allActivities
    .filter((a) => {
      if (!a.occurred_at) return false
      const d = formatDateLocal(new Date(a.occurred_at))
      return d >= from && d <= to
    })
    .slice(0, 8)

  const recent = [
    ...recentAccounts.map((r) => ({ type: '取引先', icon: '🏢', href: `/accounts/${r.id}`, title: r.name, sub: r.industry ?? '', at: r.updated_at })),
    ...recentContacts.map((r) => ({ type: '人物', icon: '👤', href: `/contacts/${r.id}`, title: r.full_name, sub: r.title ?? '', at: r.updated_at })),
    ...recentOpportunities.map((r) => ({ type: '商談', icon: '💼', href: `/opportunities/${r.id}`, title: r.name, sub: STAGE_CONFIG[r.stage]?.label ?? r.stage, at: r.updated_at })),
  ]
    .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
    .slice(0, 8)

  // 承認待ち（自分が承認すべき申請）。承認運用が無ければ空配列で、セクションは出ない。
  const userId = await getCurrentUserId()
  const perms = userId ? await getCurrentPermissions() : null
  const toDecide = userId && perms ? (await listApprovalsForUser(userId, perms.roleName)).toDecide : []
  const requesterLabels = toDecide.length > 0 ? await getUserLabels(toDecide.map((i) => i.requestedBy)) : {}

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">ホーム</h1>
          <p className="text-sm text-zinc-500 mt-1">{from} 〜 {to}</p>
        </div>
        <PeriodSelector from={from} to={to} />
      </div>

      {/* 承認待ち（自分が承認すべき申請。あるときだけ最上部に出す） */}
      {toDecide.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" strokeWidth={2.25} aria-hidden /> 承認待ち
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{toDecide.length}</span>
            </h2>
            <Link href="/approvals" className="text-xs text-blue-600 hover:text-blue-800">承認一覧 →</Link>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {toDecide.slice(0, 8).map((item) => (
              <div key={item.approvalId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={item.href} className="text-sm font-semibold text-zinc-900 hover:text-blue-700 hover:underline truncate block">{item.recordLabel}</Link>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">
                    {item.bookLabel}
                    {item.transition && <>・<b>{item.transition.from || '—'}</b> → <b>{item.transition.to || '—'}</b></>}
                    {item.totalSteps > 1 && <>・{item.currentStep}/{item.totalSteps} 段階目</>}
                    <span className="ml-1 text-zinc-400">申請: {requesterLabels[item.requestedBy] ?? '—'}</span>
                  </p>
                </div>
                <form className="flex items-center gap-1.5 shrink-0">
                  <button formAction={decideApproval.bind(null, item.approvalId, 'approved')}
                    className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">承認</button>
                  <button formAction={decideApproval.bind(null, item.approvalId, 'rejected')}
                    className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100">差戻し</button>
                </form>
                <Link href={item.href} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0">
                  詳細 <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 直近のやること（ホームの主役・期間に依存しない） */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <NavIcon icon="✅" className="w-5 h-5" /> 直近のやること
            <span className="text-zinc-400 font-normal text-sm">（期限超過・今後7日）</span>
            {overdueCount > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-danger-bg text-danger">超過 {overdueCount}</span>}
          </h2>
          <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-800">ToDo一覧 →</Link>
        </div>
        {imminentTasks.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">直近の期限ToDoはありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {imminentTasks.map((t) => {
              const rel = taskById.get(t.id) ?? { accounts: [], opportunities: [] }
              const priority = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue = t.due_date && t.due_date < today
              return (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-danger' : 'bg-warning'}`} aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-zinc-900 truncate">{t.title}</span>
                    {(rel.accounts.length > 0 || rel.opportunities.length > 0) && (
                      <span className="block text-xs text-zinc-400 truncate">{[...rel.accounts.map((a) => a.name), ...rel.opportunities.map((o) => o.name)].join(' / ')}</span>
                    )}
                  </span>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${priority.color}`}>{priority.label}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${isOverdue ? 'text-danger font-semibold' : 'text-zinc-500'}`}>
                    {t.due_date}{isOverdue && <NavIcon icon="⚠️" className="w-3.5 h-3.5 inline-block ml-1 -mt-0.5" />}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 期間内の活動 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-800">期間内の活動</h2>
              <Link href="/activities" className="text-xs text-blue-600 hover:text-blue-800">すべて見る →</Link>
            </div>
            {periodActivities.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">期間内の活動がありません</div>
            ) : (
              <>
                {/* PC: テーブル */}
                <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">種別</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">件名 / 取引先</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">日付</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {periodActivities.map((a) => {
                        const rel  = activityById.get(a.id) ?? { accounts: [] }
                        const type = ACTIVITY_TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                        return (
                          <tr key={a.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${type.color}`}><NavIcon icon={type.icon} className="w-4 h-4 shrink-0" />{type.label}</span>
                            </td>
                            <td className="px-4 py-3 min-w-0">
                              <Link href={`/activities/${a.id}`} className="font-medium text-zinc-900 hover:text-blue-600 block truncate max-w-xs">{a.subject}</Link>
                              {rel.accounts.length > 0 && (
                                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                                  {rel.accounts.map((x) => x.name).join(', ')}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-sm">
                              {a.occurred_at ? fmtDate(a.occurred_at, tz) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* モバイル: カード */}
                <div className="md:hidden space-y-2">
                  {periodActivities.map((a) => {
                    const rel  = activityById.get(a.id) ?? { accounts: [] }
                    const type = ACTIVITY_TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                    return (
                      <Link key={a.id} href={`/activities/${a.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${type.color}`}><NavIcon icon={type.icon} className="w-4 h-4 shrink-0" />{type.label}</span>
                          <span className="text-xs text-zinc-400">{a.occurred_at ? fmtDate(a.occurred_at, tz) : '—'}</span>
                        </div>
                        <p className="font-medium text-zinc-900 text-sm mt-1.5 leading-snug">{a.subject}</p>
                        {rel.accounts.length > 0 && (
                          <p className="text-xs text-zinc-400 mt-0.5 inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{rel.accounts.map((x) => x.name).join(', ')}</p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {/* 最近更新されたレコード */}
          <section>
            <h2 className="font-semibold text-zinc-800 mb-3">最近更新されたレコード</h2>
            {recent.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">なし</div>
            ) : (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-zinc-600">種別</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-600">名前</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {recent.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                            <NavIcon icon={r.icon} className="w-4 h-4 shrink-0" />{r.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-0">
                          <Link href={r.href} className="font-medium text-zinc-900 hover:text-blue-600 block truncate max-w-sm">
                            {r.title}
                          </Link>
                          {r.sub && <p className="text-xs text-zinc-400 mt-0.5 truncate">{r.sub}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
      </div>
    </div>
  )
}
