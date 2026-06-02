export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, activities, tasks, vehicles, task_related_records, activity_related_records, maintenance_records, customer_vehicles, parts, part_movements } from '@/lib/schema'
import { eq, desc, asc, ne, count, and, isNotNull, lte, inArray, notInArray } from 'drizzle-orm'
import Link from 'next/link'
import PeriodSelector from '@/components/PeriodSelector'
import { activeIndustry } from '@/lib/industry'
import { getMaintenanceForecast, sumMaintenanceWeighted } from '@/industries/auto-body/lib/maintenanceForecast'
import { calcProfit } from '@/industries/real-estate/lib/realEstateCommission'
import { formatDateLocal, todayLocal, lastOfMonth } from '@/lib/dateUtils'
import { getActivityTypes } from '@/lib/activityTypes'
import { daysUntilInspection } from '@/industries/auto-body/lib/autoBodyService'
import { calcStock, stockBadgeColor } from '@/industries/auto-body/lib/partsHelpers'
import { getReceivables, sumReceivables } from '@/industries/auto-body/lib/maintenanceReceivables'
import { STATUS_PALETTE, MAINTENANCE_STATUSES } from '@/industries/auto-body/lib/icons'
import { isWidgetEnabled } from '@/lib/dashboard/widgets'
import { getDashboardWidgetPrefs } from '@/lib/dashboard/userPrefs'
import { getCurrentUserId } from '@/lib/auth'

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

  // ユーザー個別のウィジェット設定 (ベース機能)
  const currentUserId = await getCurrentUserId()
  const widgetPrefs   = await getDashboardWidgetPrefs(currentUserId)

  // 30日先までの車検期限車両（auto-body widget 用）
  const inspectionLimitDate = new Date()
  inspectionLimitDate.setDate(inspectionLimitDate.getDate() + 30)
  const inspectionLimit = formatDateLocal(inspectionLimitDate)
  const [upcomingInspections, maintList, activeLoaners, allParts, allPartMovements, receivables] = await Promise.all([
    isAutoBody
      ? db.select({
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
      : Promise.resolve([]),
    // auto-body: 期間内の整備（売上予測加算用）
    isAutoBody ? getMaintenanceForecast(from, to) : Promise.resolve([]),
    // auto-body: 現在代車として貸出中の車両（Issue #45）
    //   整備の loaner_vehicle_id がセット中 かつ 整備が未完了/未キャンセル のもの
    isAutoBody
      ? db.select({
          maintenance_id:      maintenance_records.id,
          maintenance_no:      maintenance_records.maintenance_no,
          maintenance_status:  maintenance_records.status,
          loaner_handover_at:  maintenance_records.loaner_handover_at,
          vehicle:             {
            id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate,
          },
          customer_account:    { id: accounts.id, name: accounts.name },
          customer_contact:    { id: contacts.id, full_name: contacts.full_name },
          customer_vehicle:    { id: customer_vehicles.id, plate_number: customer_vehicles.plate_number },
        })
          .from(maintenance_records)
          .innerJoin(vehicles, eq(maintenance_records.loaner_vehicle_id, vehicles.id))
          .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
          .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
          .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
          .where(and(
            isNotNull(maintenance_records.loaner_vehicle_id),
            notInArray(maintenance_records.status, ['完了', 'キャンセル']),
          ))
          .orderBy(desc(maintenance_records.loaner_handover_at))
          .limit(10)
      : Promise.resolve([]),
    // auto-body: 部品マスタ（低在庫アラート用） — Issue #47
    isAutoBody
      ? db.select({
          id:                  parts.id,
          part_number:         parts.part_number,
          name:                parts.name,
          reorder_level:       parts.reorder_level,
          supplier:            { id: accounts.id, name: accounts.name },
        })
          .from(parts)
          .leftJoin(accounts, eq(parts.supplier_account_id, accounts.id))
      : Promise.resolve([]),
    isAutoBody
      ? db.select({
          part_id:       part_movements.part_id,
          movement_type: part_movements.movement_type,
          quantity:      part_movements.quantity,
        }).from(part_movements)
      : Promise.resolve([]),
    // auto-body: 売掛金（未入金） — Issue #48 Phase 1
    isAutoBody ? getReceivables(10) : Promise.resolve([]),
  ])

  // auto-body: 作業進行状況 - ステータス別件数 (Phase A)
  //   キャンセル含まず、進行中/完了の状態別件数を集計
  const workProgressCounts: Record<string, number> = {}
  for (const s of MAINTENANCE_STATUSES) workProgressCounts[s] = 0
  if (isAutoBody) {
    const statusRows = await db.select({
      status: maintenance_records.status,
      c:      count(),
    })
      .from(maintenance_records)
      .where(notInArray(maintenance_records.status, ['完了', 'キャンセル']))
      .groupBy(maintenance_records.status)
    for (const r of statusRows) workProgressCounts[r.status] = Number(r.c ?? 0)

    // 完了は当日納車分だけ
    const todayStr = todayLocal()
    const completedToday = await db.select({ c: count() })
      .from(maintenance_records)
      .where(and(
        eq(maintenance_records.status, '完了'),
        eq(maintenance_records.delivery_date, todayStr),
      ))
    workProgressCounts['完了'] = Number(completedToday[0]?.c ?? 0)
  }

  const totalReceivables = sumReceivables(receivables)

  // 部品の現在庫を集計し、reorder_level 以下の部品を抽出（最大 10 件）
  const lowStockParts = (() => {
    if (!isAutoBody || allParts.length === 0) return []
    const byPart = new Map<string, { movement_type: string; quantity: number | null }[]>()
    for (const m of allPartMovements) {
      const arr = byPart.get(m.part_id) ?? []
      arr.push({ movement_type: m.movement_type, quantity: m.quantity })
      byPart.set(m.part_id, arr)
    }
    return allParts
      .map((p) => ({ ...p, stock: calcStock(byPart.get(p.id) ?? []) }))
      .filter((p) => p.stock <= (p.reorder_level ?? 0))
      // 在庫切れを最優先、次に在庫が少ない順
      .sort((a, b) => {
        if (a.stock === 0 && b.stock !== 0) return -1
        if (b.stock === 0 && a.stock !== 0) return 1
        return a.stock - b.stock
      })
      .slice(0, 10)
  })()
  const maintWeighted = sumMaintenanceWeighted(maintList)

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
    // tasks 単体を取得（関連は junction 経由で後段で attach）
    db.select({
      id: tasks.id, title: tasks.title, done: tasks.done,
      priority: tasks.priority, due_date: tasks.due_date,
    })
      .from(tasks)
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

  const oppForecast = periodOpps.reduce((sum, o) => {
    const base = baseRevenueOf(o)
    return sum + base * (o.probability != null ? o.probability / 100 : 1)
  }, 0)
  // auto-body は 商談 + 整備 の合算
  const forecast = oppForecast + maintWeighted

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
          isAutoBody
            ? { label: '期間内の商談+整備', value: periodOpps.length + maintList.length, unit: '件', href: `/forecast?from=${from}&to=${to}`, color: 'text-blue-600', sub: `商談 ${periodOpps.length} + 整備 ${maintList.length}` }
            : { label: '期間内の商談', value: periodOpps.length, unit: '件', href: `/forecast?from=${from}&to=${to}`, color: 'text-blue-600', sub: '完了予定が期間内' },
          {
            label: '期間内の想定売上',
            value: `¥${Math.round(forecast).toLocaleString()}`,
            unit: '',
            href: `/forecast?from=${from}&to=${to}`,
            color: 'text-green-700',
            sub: isAutoBody
              ? `商談 ¥${Math.round(oppForecast).toLocaleString()} + 整備 ¥${Math.round(maintWeighted).toLocaleString()}`
              : isReal ? '確度 × 利益' : '確度 × 金額',
          },
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
                        const rel = taskById.get(t.id) ?? { accounts: [], opportunities: [] }
                        const priority    = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
                        const isOverdue   = t.due_date && t.due_date < today
                        return (
                          <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              <Link href={`/tasks/${t.id}`} className="hover:text-blue-600 block truncate max-w-xs">{t.title}</Link>
                              {rel.opportunities.length > 0 && (
                                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                                  💼 {rel.opportunities.map((o) => o.name).join(', ')}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>{priority.label}</span>
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap text-sm ${isOverdue ? 'text-red-500 font-medium' : 'text-zinc-600'}`}>
                              {t.due_date ?? '—'}{isOverdue ? ' ⚠️' : ''}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-sm">
                              {rel.accounts.length > 0 ? (
                                <span className="block truncate max-w-[12rem]">
                                  {rel.accounts.map((a, i) => (
                                    <span key={a.id}>
                                      <Link href={`/accounts/${a.id}`} className="hover:text-blue-600">{a.name}</Link>
                                      {i < rel.accounts.length - 1 && ', '}
                                    </span>
                                  ))}
                                </span>
                              ) : <span className="text-zinc-300">—</span>}
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
                    const rel = taskById.get(t.id) ?? { accounts: [], opportunities: [] }
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
                          {rel.accounts.length > 0 && <span>🏢 {rel.accounts.map((a) => a.name).join(', ')}</span>}
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

          {/* 作業進行状況 (auto-body のみ) — Phase A */}
          {isAutoBody && isWidgetEnabled('auto-body-work-progress', widgetPrefs) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-zinc-800">
                  📊 作業進行状況
                </h2>
                <Link href="/maintenance" className="text-xs text-blue-600 hover:text-blue-800">整備一覧 →</Link>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {(['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了'] as const).map((status) => {
                    const palette = STATUS_PALETTE[status]
                    const count = workProgressCounts[status] ?? 0
                    const isCompleted = status === '完了'
                    return (
                      <Link
                        key={status}
                        href={`/maintenance?f=status%3Deq%3A${encodeURIComponent(status)}`}
                        className={`block rounded-lg border-2 p-3 hover:shadow-md transition-shadow ${palette.bg} ${palette.border}`}
                      >
                        <p className={`text-xs font-medium ${palette.text} mb-1`}>{status}</p>
                        <p className={`text-2xl font-bold ${palette.text}`}>{count}</p>
                        {isCompleted && <p className="text-[10px] text-zinc-500 mt-0.5">本日納車</p>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* 代車中の車両（auto-body のみ） — Issue #45 */}
          {isAutoBody && isWidgetEnabled('auto-body-active-loaners', widgetPrefs) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-zinc-800">
                  🚙 代車中の車両
                  <span className="ml-2 text-zinc-400 font-normal text-sm">({activeLoaners.length})</span>
                </h2>
                <Link href="/vehicles?f=status%3Deq%3A%E4%BB%A3%E8%BB%8A%E4%B8%AD" className="text-xs text-blue-600 hover:text-blue-800">代車中一覧 →</Link>
              </div>
              {activeLoaners.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">
                  現在代車中の車両はありません
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
                  {activeLoaners.map((l) => {
                    const customer = l.customer_account?.id ? l.customer_account.name
                      : l.customer_contact?.id ? l.customer_contact.full_name
                      : '—'
                    return (
                      <div key={l.maintenance_id} className="block px-4 py-3 hover:bg-zinc-50">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/vehicles/${l.vehicle.id}`} className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate">
                            {l.vehicle.license_plate ?? '—'}
                            <span className="text-xs text-zinc-400 ml-2">{l.vehicle.maker} {l.vehicle.model}</span>
                          </Link>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                            {l.maintenance_status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1 text-xs text-zinc-500">
                          <Link href={`/maintenance/${l.maintenance_id}`} className="hover:text-blue-600 truncate">
                            🔧 {l.maintenance_no} ／ {customer}
                          </Link>
                          {l.loaner_handover_at && (
                            <span className="shrink-0 text-zinc-400">
                              貸出: {new Date(l.loaner_handover_at).toLocaleDateString('ja-JP')}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* 低在庫部品アラート（auto-body のみ） — Issue #47 */}
          {isAutoBody && isWidgetEnabled('auto-body-low-stock-parts', widgetPrefs) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-zinc-800">
                  🔧 要発注の部品
                  <span className="ml-2 text-zinc-400 font-normal text-sm">({lowStockParts.length})</span>
                </h2>
                <Link href="/parts" className="text-xs text-blue-600 hover:text-blue-800">部品マスタ →</Link>
              </div>
              {lowStockParts.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">
                  発注しきい値を下回る部品はありません 🎉
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
                  {lowStockParts.map((p) => (
                    <Link key={p.id} href={`/parts/${p.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                            {p.name}
                            <span className="text-xs text-zinc-400 ml-2 font-mono">{p.part_number}</span>
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            発注しきい値 {p.reorder_level ?? 0} 個
                            {p.supplier?.id && <span className="ml-2">🏢 {p.supplier.name}</span>}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${stockBadgeColor(p.stock, p.reorder_level ?? 0)}`}>
                          {p.stock === 0 ? '在庫切れ' : `残 ${p.stock} 個`}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 売掛金アラート（auto-body のみ） — Issue #48 */}
          {isAutoBody && isWidgetEnabled('auto-body-receivables', widgetPrefs) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-zinc-800">
                  💰 未入金の整備
                  <span className="ml-2 text-zinc-400 font-normal text-sm">({receivables.length})</span>
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">合計 <span className="font-mono font-bold text-rose-700">¥{totalReceivables.toLocaleString()}</span></span>
                  <Link href="/receivables" className="text-xs text-blue-600 hover:text-blue-800">売掛金一覧 →</Link>
                </div>
              </div>
              {receivables.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">
                  未入金の整備はありません 🎉
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
                  {receivables.map((r) => {
                    const customer = r.account?.name ?? r.contact?.full_name ?? '—'
                    const isOverdue30 = r.daysOverdue != null && r.daysOverdue > 30
                    const isOverdue60 = r.daysOverdue != null && r.daysOverdue > 60
                    return (
                      <Link key={r.id} href={`/maintenance/${r.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-900 truncate">
                              {customer}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 ml-2 align-middle">{r.status}</span>
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5 truncate">
                              🔧 {r.maintenance_no}
                              {r.vehicle?.plate_number && <span className="ml-2">🚗 {r.vehicle.plate_number}</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-bold text-sm text-rose-700">¥{r.outstanding.toLocaleString()}</p>
                            {r.daysOverdue != null && (
                              <p className={`text-xs mt-0.5 ${
                                isOverdue60 ? 'text-red-700 font-semibold' :
                                isOverdue30 ? 'text-orange-700' :
                                'text-zinc-500'
                              }`}>
                                {r.daysOverdue < 0 ? `あと${-r.daysOverdue}日` : `${r.daysOverdue}日経過`}
                              </p>
                            )}
                          </div>
                        </div>
                        {r.paidTotal > 0 && (
                          <p className="text-[10px] text-zinc-400 mt-1">
                            一部入金済: ¥{r.paidTotal.toLocaleString()} / 請求 ¥{r.invoiceTotal.toLocaleString()}
                          </p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* 車検期限アラート（auto-body のみ） */}
          {isAutoBody && isWidgetEnabled('auto-body-upcoming-inspections', widgetPrefs) && (
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
                        const rel  = activityById.get(a.id) ?? { accounts: [] }
                        const type = ACTIVITY_TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                        return (
                          <tr key={a.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>{type.icon} {type.label}</span>
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
                    const rel  = activityById.get(a.id) ?? { accounts: [] }
                    const type = ACTIVITY_TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                    return (
                      <Link key={a.id} href={`/activities/${a.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${type.color}`}>{type.icon} {type.label}</span>
                          <span className="text-xs text-zinc-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}</span>
                        </div>
                        <p className="font-medium text-zinc-900 text-sm mt-1.5 leading-snug">{a.subject}</p>
                        {rel.accounts.length > 0 && (
                          <p className="text-xs text-zinc-400 mt-0.5">🏢 {rel.accounts.map((x) => x.name).join(', ')}</p>
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
