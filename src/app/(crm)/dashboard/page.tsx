export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, activities, tasks, vehicles } from '@/lib/schema'
import { eq, desc, asc, ne, count, and, isNotNull, lte } from 'drizzle-orm'
import Link from 'next/link'
import PeriodSelector from '@/components/PeriodSelector'
import { activeIndustry } from '@/lib/industry'
import { calcProfit } from '@/industries/real-estate/lib/realEstateCommission'
import { formatDateLocal, todayLocal, lastOfMonth } from '@/lib/dateUtils'
import { getActivityTypes } from '@/lib/activityTypes'
import { daysUntilInspection } from '@/industries/auto-body/lib/autoBodyService'

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'bg-red-50 text-red-600' },
  medium: { label: '中', color: 'bg-yellow-50 text-yellow-700' },
  low:    { label: '低', color: 'bg-green-50 text-green-700' },
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  prospecting:   { label: '見込み',   color: 'bg-zinc-100 text-zinc-600' },
  qualification: { label: '要件確認', color: 'bg-blue-100 text-blue-700' },
  proposal:      { label: '提案',     color: 'bg-yellow-100 text-yellow-700' },
  negotiation:   { label: '交渉',     color: 'bg-orange-100 text-orange-700' },
  closed_won:    { label: '受注',     color: 'bg-green-100 text-green-700' },
  closed_lost:   { label: '失注',     color: 'bg-red-100 text-red-600' },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
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

  const isReal     = activeIndustry === 'real-estate'
  const isAutoBody = activeIndustry === 'auto-body'

  // 30日先までの車検期限車両（auto-body widget 用）
  const inspectionLimitDate = new Date()
  inspectionLimitDate.setDate(inspectionLimitDate.getDate() + 30)
  const inspectionLimit = formatDateLocal(inspectionLimitDate)
  const upcomingInspections = isAutoBody
    ? await db.select({
        id:                   vehicles.id,
        maker:                vehicles.maker,
        model:                vehicles.model,
        license_plate:        vehicles.license_plate,
        next_inspection_date: vehicles.next_inspection_date,
        status:               vehicles.status,
      })
        .from(vehicles)
        .where(and(
          isNotNull(vehicles.next_inspection_date),
          lte(vehicles.next_inspection_date, inspectionLimit),
          ne(vehicles.status, '廃車'),
        ))
        .orderBy(asc(vehicles.next_inspection_date))
        .limit(20)
    : []

  const [
    accountCountRows,
    pendingTasks,
    allOpportunities,
    recentAccounts,
    recentContacts,
    recentOpportunities,
    allActivities,
  ] = await Promise.all([
    db.select({ count: count() }).from(accounts).where(ne(accounts.status, 'inactive')),
    db.select({
      id: tasks.id, title: tasks.title, done: tasks.done,
      priority: tasks.priority, due_date: tasks.due_date,
      accounts:      { id: accounts.id, name: accounts.name },
      opportunities: { id: opportunities.id, name: opportunities.name },
    })
      .from(tasks)
      .leftJoin(accounts, eq(tasks.account_id, accounts.id))
      .leftJoin(opportunities, eq(tasks.opportunity_id, opportunities.id))
      .where(eq(tasks.done, false))
      .orderBy(asc(tasks.due_date)),
    db.select({
      id: opportunities.id, name: opportunities.name, stage: opportunities.stage,
      amount: opportunities.amount, probability: opportunities.probability,
      close_date: opportunities.close_date,
      commission_fee: opportunities.commission_fee,
      brokerage_type: opportunities.brokerage_type,
      other_profit: opportunities.other_profit,
      accounts: { name: accounts.name },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .where(ne(opportunities.stage, 'closed_lost'))
      .orderBy(asc(opportunities.close_date)),
    db.select({ id: accounts.id, name: accounts.name, industry: accounts.industry, updated_at: accounts.updated_at })
      .from(accounts).orderBy(desc(accounts.updated_at)).limit(4),
    db.select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title, updated_at: contacts.updated_at })
      .from(contacts).orderBy(desc(contacts.updated_at)).limit(4),
    db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage, updated_at: opportunities.updated_at })
      .from(opportunities).orderBy(desc(opportunities.updated_at)).limit(4),
    db.select({
      id: activities.id, type: activities.type, subject: activities.subject,
      occurred_at: activities.occurred_at,
      accounts: { name: accounts.name },
    })
      .from(activities)
      .leftJoin(accounts, eq(activities.account_id, accounts.id))
      .orderBy(desc(activities.occurred_at)),
  ])

  // 期間内の商談（close_date で絞る）
  const periodOpps = allOpportunities.filter(
    (o) => o.close_date && o.close_date >= from && o.close_date <= to
  )

  // 期間内の期限タスク
  const periodTasks = pendingTasks.filter(
    (t) => t.due_date && t.due_date >= from && t.due_date <= to
  )

  // 期間内の活動（occurred_at で絞る、ローカルタイムの日付で比較）
  const periodActivities = allActivities
    .filter((a) => {
      if (!a.occurred_at) return false
      const d = formatDateLocal(new Date(a.occurred_at))
      return d >= from && d <= to
    })
    .slice(0, 8)

  const accountCount = accountCountRows[0]?.count ?? 0

  const baseRevenueOf = (o: typeof periodOpps[number]) => {
    if (!isReal) return Number(o.amount ?? 0)
    const fee = o.commission_fee != null ? Number(o.commission_fee) : null
    const oth = o.other_profit != null ? Number(o.other_profit) : 0
    return fee != null ? calcProfit(fee, o.brokerage_type, oth) : 0
  }

  const forecast = periodOpps.reduce((sum, o) => {
    const base = baseRevenueOf(o)
    return sum + base * (o.probability != null ? o.probability / 100 : 1)
  }, 0)

  const recent = [
    ...recentAccounts.map((r) => ({ type: '取引先', icon: '🏢', href: `/accounts/${r.id}`, title: r.name, sub: r.industry ?? '', at: r.updated_at })),
    ...recentContacts.map((r) => ({ type: '人物', icon: '👤', href: `/contacts/${r.id}`, title: r.full_name, sub: r.title ?? '', at: r.updated_at })),
    ...recentOpportunities.map((r) => ({ type: '商談', icon: '💼', href: `/opportunities/${r.id}`, title: r.name, sub: STAGE_CONFIG[r.stage]?.label ?? r.stage, at: r.updated_at })),
  ]
    .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
    .slice(0, 8)

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">ダッシュボード</h1>
          <p className="text-sm text-zinc-500 mt-1">{from} 〜 {to}</p>
        </div>
        <PeriodSelector from={from} to={to} />
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'アクティブな取引先', value: accountCount, unit: '社', href: '/accounts', color: 'text-zinc-800', sub: '期間外集計' },
          { label: '期間内のToDo', value: periodTasks.length, unit: '件', href: '/tasks', color: periodTasks.length > 0 ? 'text-orange-600' : 'text-zinc-800', sub: '未完了・期限が期間内' },
          { label: '期間内の商談', value: periodOpps.length, unit: '件', href: `/forecast?from=${from}&to=${to}`, color: 'text-blue-600', sub: '完了予定が期間内' },
          { label: '期間内の想定売上', value: `¥${Math.round(forecast).toLocaleString()}`, unit: '', href: `/forecast?from=${from}&to=${to}`, color: 'text-green-700', sub: isReal ? '確度 × 利益' : '確度 × 金額' },
        ].map((k) => (
          <Link key={k.label} href={k.href} className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
            <p className="text-xs text-zinc-400 mb-2">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>
              {typeof k.value === 'number' ? k.value.toLocaleString() : k.value}
              {k.unit && <span className="text-sm font-normal text-zinc-500 ml-1">{k.unit}</span>}
            </p>
            {k.sub && <p className="text-xs text-zinc-400 mt-1">{k.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* 左カラム */}
        <div className="col-span-1 md:col-span-3 space-y-6">

          {/* 期限が近いToDo */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-800">
                期間内のToDo
                <span className="ml-2 text-zinc-400 font-normal text-sm">({periodTasks.length})</span>
              </h2>
              <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-800">すべて見る →</Link>
            </div>
            {periodTasks.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">
                期間内のToDoはありません 🎉
              </div>
            ) : (
              <>
                {/* PC: テーブル */}
                <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">タイトル</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">優先度</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">期限</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">取引先</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {periodTasks.map((t) => {
                        const account     = t.accounts?.id     ? t.accounts     : null
                        const opportunity = t.opportunities?.id ? t.opportunities : null
                        const priority    = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
                        const isOverdue   = t.due_date && t.due_date < today
                        return (
                          <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              <Link href={`/tasks/${t.id}`} className="hover:text-blue-600 block truncate max-w-xs">{t.title}</Link>
                              {opportunity && <p className="text-xs text-zinc-400 mt-0.5 truncate">💼 {opportunity.name}</p>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>{priority.label}</span>
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap text-sm ${isOverdue ? 'text-red-500 font-medium' : 'text-zinc-600'}`}>
                              {t.due_date ?? '—'}{isOverdue ? ' ⚠️' : ''}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-sm">
                              {account ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600 truncate block max-w-[12rem]">{account.name}</Link> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/tasks/${t.id}`} className="text-blue-600 hover:text-blue-800 text-xs">詳細 →</Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* モバイル: カード */}
                <div className="md:hidden space-y-2">
                  {periodTasks.map((t) => {
                    const account  = t.accounts?.id ? t.accounts : null
                    const priority = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
                    const isOverdue = t.due_date && t.due_date < today
                    return (
                      <Link key={t.id} href={`/tasks/${t.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-zinc-900 text-sm leading-snug">{t.title}</span>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                          {t.due_date && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>📅 {t.due_date}{isOverdue ? ' ⚠️' : ''}</span>}
                          {account && <span>🏢 {account.name}</span>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {/* 期間内の商談 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-800">
                期間内の商談
                <span className="ml-2 text-zinc-400 font-normal text-sm">({periodOpps.length})</span>
              </h2>
              <Link href={`/forecast?from=${from}&to=${to}`} className="text-xs text-blue-600 hover:text-blue-800">売上予測へ →</Link>
            </div>
            {periodOpps.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">
                期間内に完了予定の商談がありません
              </div>
            ) : (
              <>
                {/* PC: テーブル */}
                <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">商談名</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">ステージ</th>
                        <th className="text-left px-4 py-3 font-medium text-zinc-600">完了予定日</th>
                        <th className="text-right px-4 py-3 font-medium text-zinc-600">想定売上</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {periodOpps.slice(0, 5).map((o) => {
                        const base     = baseRevenueOf(o)
                        const prob     = o.probability != null ? o.probability / 100 : 1
                        const weighted = Math.round(base * prob)
                        const account  = o.accounts?.name ? o.accounts : null
                        const stage    = STAGE_CONFIG[o.stage] ?? { label: o.stage, color: 'bg-zinc-100 text-zinc-600' }
                        return (
                          <tr key={o.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              <Link href={`/opportunities/${o.id}`} className="hover:text-blue-600 block truncate max-w-[14rem]">{o.name}</Link>
                              {account && <p className="text-xs text-zinc-400 mt-0.5">{account.name}</p>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stage.color}`}>{stage.label}</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{o.close_date ?? '—'}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="font-semibold text-blue-700">¥{weighted.toLocaleString()}</span>
                              {o.probability != null && <p className="text-xs text-zinc-400">確度 {o.probability}%</p>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/opportunities/${o.id}`} className="text-blue-600 hover:text-blue-800 text-xs">詳細 →</Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* モバイル: カード */}
                <div className="md:hidden space-y-2">
                  {periodOpps.slice(0, 5).map((o) => {
                    const base     = baseRevenueOf(o)
                    const prob     = o.probability != null ? o.probability / 100 : 1
                    const weighted = Math.round(base * prob)
                    const account  = o.accounts?.name ? o.accounts : null
                    const stage    = STAGE_CONFIG[o.stage] ?? { label: o.stage, color: 'bg-zinc-100 text-zinc-600' }
                    return (
                      <Link key={o.id} href={`/opportunities/${o.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-zinc-900 text-sm leading-snug">{o.name}</span>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${stage.color}`}>{stage.label}</span>
                        </div>
                        {account && <p className="text-xs text-zinc-400 mt-0.5">🏢 {account.name}</p>}
                        <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                          <span>{o.close_date ?? '期限なし'}</span>
                          <span className="font-semibold text-blue-700">¥{weighted.toLocaleString()}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        {/* 右カラム */}
        <div className="col-span-1 md:col-span-2 space-y-6">

          {/* 車検期限アラート（auto-body のみ） */}
          {isAutoBody && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-zinc-800">
                  🚗 車検期限アラート
                  <span className="ml-2 text-zinc-400 font-normal text-sm">(30日以内・経過)</span>
                </h2>
                <Link href="/vehicles" className="text-xs text-blue-600 hover:text-blue-800">車両一覧 →</Link>
              </div>
              {upcomingInspections.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">
                  対象車両はありません 🎉
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
                  {upcomingInspections.map((v) => {
                    const days = daysUntilInspection(v.next_inspection_date)
                    const expired = days != null && days < 0
                    const urgent  = days != null && days >= 0 && days <= 7
                    return (
                      <Link key={v.id} href={`/vehicles/${v.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-900 truncate">
                              {v.maker} {v.model}
                              {v.license_plate && <span className="text-xs text-zinc-400 ml-2">{v.license_plate}</span>}
                            </p>
                            <p className="text-xs text-zinc-400">{v.next_inspection_date} ・ {v.status}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            expired ? 'bg-red-50 text-red-700' :
                            urgent  ? 'bg-orange-50 text-orange-700' :
                                      'bg-yellow-50 text-yellow-700'
                          }`}>
                            {days != null && (expired ? `${-days}日経過` : `あと${days}日`)}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          )}

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
                        const account = a.accounts?.name ? a.accounts : null
                        const type    = ACTIVITY_TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                        return (
                          <tr key={a.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>{type.icon} {type.label}</span>
                            </td>
                            <td className="px-4 py-3 min-w-0">
                              <Link href={`/activities/${a.id}`} className="font-medium text-zinc-900 hover:text-blue-600 block truncate max-w-xs">{a.subject}</Link>
                              {account && <p className="text-xs text-zinc-400 mt-0.5 truncate">{account.name}</p>}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-sm">
                              {a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}
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
                    const account = a.accounts?.name ? a.accounts : null
                    const type    = ACTIVITY_TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                    return (
                      <Link key={a.id} href={`/activities/${a.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${type.color}`}>{type.icon} {type.label}</span>
                          <span className="text-xs text-zinc-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}</span>
                        </div>
                        <p className="font-medium text-zinc-900 text-sm mt-1.5 leading-snug">{a.subject}</p>
                        {account && <p className="text-xs text-zinc-400 mt-0.5">🏢 {account.name}</p>}
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
                            {r.icon} {r.type}
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
    </div>
  )
}
