import { db } from '@/lib/db'
import { maintenance_records, customer_vehicles, accounts, contacts } from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, buildWhere, type FilterColumnResolver,
} from '@/lib/filterUtils'
import { AB_ICONS, STATUS_PALETTE } from '@/industries/auto-body/lib/icons'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'
import { NavIcon } from '@/lib/navIcon'
import MaintenanceBoard, { type BoardColumn } from '@/industries/auto-body/components/MaintenanceBoard'
import { Wrench, Package, CheckCheck, ClipboardList, LayoutList, Kanban } from 'lucide-react'

const STATUSES = ['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了', 'キャンセル']
/** カンバン列に出すステータス（キャンセルは除外） */
const BOARD_STATUSES = ['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了']

/** ビュー切替トグル（ボード / リスト） */
function ViewToggle({ view }: { view: 'board' | 'list' }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors'
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
      <Link href="/maintenance?view=board" className={`${base} ${view === 'board' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
        <Kanban className="w-4 h-4" strokeWidth={2.25} aria-hidden />ボード
      </Link>
      <Link href="/maintenance?view=list" className={`${base} ${view === 'list' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
        <LayoutList className="w-4 h-4" strokeWidth={2.25} aria-hidden />リスト
      </Link>
    </div>
  )
}

function statusClass(status: string): string {
  const p = STATUS_PALETTE[status]
  if (!p) return 'bg-zinc-100 text-zinc-600'
  return `${p.bg} ${p.text}`
}

export default async function MaintenanceListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string; view?: string }>
}) {
  const sp = await searchParams
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0
  // 既定はボード（カンバン）。view=list か、一覧操作（フィルタ/グループ）時はリスト。
  const view: 'board' | 'list' = sp.view === 'list' || (sp.view !== 'board' && (filterRaw.length > 0 || isGrouped)) ? 'list' : 'board'

  // フィルター解決マップ
  const resolver: FilterColumnResolver = {
    status:             { col: maintenance_records.status,             type: 'select' },
    intake_date:        { col: maintenance_records.intake_date,        type: 'date' },
    delivery_date:      { col: maintenance_records.delivery_date,      type: 'date' },
    branch_id:          { col: maintenance_records.branch_id,          type: 'text' },
    intake_category:    { col: maintenance_records.intake_category,    type: 'text' },
    mileage:            { col: maintenance_records.mileage,            type: 'number' },
    account_id:         { col: maintenance_records.account_id,         type: 'select' },
    reception_owner_id: { col: maintenance_records.reception_owner_id, type: 'select' },
    worker_owner_id:    { col: maintenance_records.worker_owner_id,    type: 'select' },
  }
  const conditions = parseFilterParams(filterRaw)
  const where = buildWhere(conditions, resolver)

  const [rows, edit, allUsers, allAccounts] = await Promise.all([
    db.select({
      id:             maintenance_records.id,
      maintenance_no: maintenance_records.maintenance_no,
      intake_date:    maintenance_records.intake_date,
      delivery_date:  maintenance_records.delivery_date,
      status:         maintenance_records.status,
      mileage:        maintenance_records.mileage,
      branch_id:      maintenance_records.branch_id,
      intake_category: maintenance_records.intake_category,
      reception_owner_id: maintenance_records.reception_owner_id,
      worker_owner_id: maintenance_records.worker_owner_id,
      vehicle: {
        id:           customer_vehicles.id,
        plate_number: customer_vehicles.plate_number,
        car_model:    customer_vehicles.car_model,
        car_name:     customer_vehicles.car_name,
      },
      account: { id: accounts.id, name: accounts.name },
      contact: { id: contacts.id, full_name: contacts.full_name },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .where(where ?? sql`true`)
      .orderBy(desc(maintenance_records.intake_date), desc(maintenance_records.created_at)),
    canEdit(),
    getAllUsers(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(accounts.name),
  ])

  const FIELDS: FieldDef[] = [
    {
      value: 'status', label: 'ステータス', type: 'select',
      options: STATUSES.map((s) => ({ value: s, label: s })),
    },
    { value: 'intake_date',     label: '入庫日',     type: 'date' },
    { value: 'delivery_date',   label: '納車日',     type: 'date' },
    { value: 'branch_id',       label: '拠点',       type: 'text' },
    { value: 'intake_category', label: '入庫区分',   type: 'text' },
    { value: 'mileage',         label: '走行距離',   type: 'number' },
    {
      value: 'account_id', label: '取引先', type: 'select',
      options: allAccounts.map((a) => ({ value: a.id, label: a.name })),
    },
    {
      value: 'reception_owner_id', label: '受付担当', type: 'select',
      options: allUsers.map((u) => ({ value: u.id, label: u.name })),
    },
    {
      value: 'worker_owner_id', label: '作業担当', type: 'select',
      options: allUsers.map((u) => ({ value: u.id, label: u.name })),
    },
  ]
  const groupableFields = FIELDS
    .filter((f) => ['status', 'branch_id', 'intake_category', 'reception_owner_id', 'worker_owner_id', 'account_id'].includes(f.value))
    .map((f) => ({ key: f.value, label: f.label }))

  const hasFilter = conditions.length > 0
  const totalCount = rows.length

  // ── ボード（カンバン）ビュー ──────────────────────────────────
  if (view === 'board') {
    const userName = new Map(allUsers.map((u) => [u.id, u.name]))
    const today = new Date().toISOString().slice(0, 10)
    const customerOf = (m: typeof rows[number]): { name: string | null; isPersonal: boolean } => {
      const acc = m.account?.id ? m.account : null
      const con = m.contact?.id ? m.contact : null
      if (acc && !isPersonalAccount(acc)) return { name: acc.name, isPersonal: false }
      if (con) return { name: con.full_name, isPersonal: true }
      return { name: acc?.name ?? null, isPersonal: true }
    }
    const columns: BoardColumn[] = BOARD_STATUSES.map((status) => {
      const pal = STATUS_PALETTE[status]
      const jobs = rows.filter((m) => m.status === status).map((m) => {
        const cust = customerOf(m)
        const over = Boolean(m.delivery_date && m.delivery_date < today && status !== '完了')
        return {
          id: m.id,
          plate: m.vehicle?.plate_number ?? m.vehicle?.car_model ?? '—',
          vehicleName: m.vehicle?.car_name ?? m.vehicle?.car_model ?? '車両',
          customer: cust.name,
          isPersonal: cust.isPersonal,
          work: m.intake_category ?? null,
          branch: m.branch_id ?? null,
          eta: m.delivery_date ?? m.intake_date ?? null,
          mechChar: (m.worker_owner_id && userName.get(m.worker_owner_id)?.trim()?.[0]) || '—',
          over,
        }
      })
      return { status, color: pal?.activeColor ?? '#64748b', badgeBg: pal?.bg ?? 'bg-n-100', badgeText: pal?.text ?? 'text-n-600', jobs }
    })
    const cnt = (s: string) => rows.filter((m) => m.status === s).length
    const todayDelivery = rows.filter((m) => m.delivery_date === today && m.status !== '完了' && m.status !== 'キャンセル').length
    const stats = [
      { icon: <Wrench className="w-4.5 h-4.5" strokeWidth={2.25} />, iconCls: 'bg-brand-50 text-brand-700', value: cnt('作業中'), label: '作業中の車両' },
      { icon: <Package className="w-4.5 h-4.5" strokeWidth={2.25} />, iconCls: 'bg-warning-bg text-warning', value: cnt('部品待ち'), label: '部品待ち' },
      { icon: <CheckCheck className="w-4.5 h-4.5" strokeWidth={2.25} />, iconCls: 'bg-positive-bg text-positive', value: todayDelivery, label: '本日納車予定' },
      { icon: <ClipboardList className="w-4.5 h-4.5" strokeWidth={2.25} />, iconCls: 'bg-info-bg text-info', value: cnt('予約') + cnt('受付'), label: '受付・予約' },
    ]

    return (
      <div className="flex flex-col h-full p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-zinc-900">整備</h1>
          <div className="flex items-center gap-2">
            <ViewToggle view="board" />
            {edit && (
              <Link href="/maintenance/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm">
                <NavIcon icon="🔧" className="w-4 h-4" />受付を作成
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 mb-4">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-zinc-200 rounded-lg shadow-xs">
              <span className={`grid place-items-center w-8 h-8 rounded-md shrink-0 ${s.iconCls}`}>{s.icon}</span>
              <span>
                <span className="block text-xl font-bold text-zinc-900 tabular-nums leading-none">{s.value}</span>
                <span className="block text-xs text-zinc-500 mt-1 whitespace-nowrap">{s.label}</span>
              </span>
            </div>
          ))}
        </div>
        {totalCount === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <div className="flex justify-center mb-4"><NavIcon icon="🔧" className="w-12 h-12 text-zinc-300" /></div>
            <p className="text-lg font-medium">整備がまだ登録されていません</p>
            <p className="text-sm mt-1">「受付を作成」ボタンから追加してください</p>
          </div>
        ) : (
          <MaintenanceBoard columns={columns} />
        )}
      </div>
    )
  }

  // 簡易グルーピング（第1グループのみ）
  type Row = typeof rows[number]
  const groupedRows: { label: string; records: Row[] }[] = (() => {
    if (!isGrouped) return [{ label: '', records: rows }]
    const groupField = groupBy[0]
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      let raw: string | null = null
      if (groupField === 'status') raw = r.status
      else if (groupField === 'branch_id') raw = r.branch_id ?? null
      else if (groupField === 'intake_category') raw = r.intake_category ?? null
      else if (groupField === 'reception_owner_id') raw = r.reception_owner_id ?? null
      else if (groupField === 'worker_owner_id') raw = r.worker_owner_id ?? null
      else if (groupField === 'account_id') raw = r.account?.id ?? null
      const key = raw ?? '__null__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).map(([key, records]) => {
      let label = '（未設定）'
      if (groupField === 'reception_owner_id' || groupField === 'worker_owner_id') {
        if (key !== '__null__') label = allUsers.find((u) => u.id === key)?.name ?? '（不明）'
      } else if (groupField === 'account_id') {
        if (key !== '__null__') label = allAccounts.find((a) => a.id === key)?.name ?? '（不明）'
      } else if (key !== '__null__') {
        label = key
      }
      return { label, records }
    })
  })()

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">整備</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view="list" />
          {edit && (
            <Link href="/maintenance/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm">
              ＋ 整備を作成
            </Link>
          )}
        </div>
      </div>

      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/maintenance"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <NavIcon icon={AB_ICONS.maintenance} className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する整備がありません' : '整備がまだ登録されていません'}
          </p>
          {hasFilter
            ? <Link href="/maintenance" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「整備を作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <div className="space-y-4">
          {groupedRows.map((g, gi) => (
            <div key={gi}>
              {isGrouped && (
                <div className="mb-2 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-t-md">
                  {g.label} <span className="text-xs text-violet-500 font-normal">({g.records.length})</span>
                </div>
              )}

              {/* PC: テーブル */}
              <div className="hidden md:block bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">整備名</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">整備No</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">入庫日</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">納車日</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">車両</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">顧客</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">ステータス</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-700">走行距離</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {g.records.map((m) => {
                      const acc = m.account?.id ? m.account : null
                      const con = m.contact?.id ? m.contact : null
                      const displayName = maintenanceDisplayName(m, acc, con, m.vehicle)
                      return (
                        <tr key={m.id} className="hover:bg-zinc-50/30">
                          <td className="px-4 py-2">
                            <Link href={`/maintenance/${m.id}`} className="text-blue-600 hover:text-blue-800 hover:underline break-all">{displayName}</Link>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-zinc-500">{m.maintenance_no}</td>
                          <td className="px-4 py-2 text-zinc-700">{m.intake_date ?? '—'}</td>
                          <td className="px-4 py-2 text-zinc-700">{m.delivery_date ?? '—'}</td>
                          <td className="px-4 py-2 text-zinc-700">
                            {m.vehicle?.id ? (
                              <Link href={`/customer-vehicles/${m.vehicle.id}`} className="hover:text-blue-700">
                                <NavIcon icon={AB_ICONS.customerVehicle} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{m.vehicle.plate_number ?? m.vehicle.car_model ?? '—'}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2 text-zinc-700">
                            {acc && !isPersonalAccount(acc) ? (
                              <Link href={`/accounts/${acc.id}`} className="hover:text-blue-700">
                                <NavIcon icon={AB_ICONS.account} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{acc.name}
                              </Link>
                            ) : con ? (
                              <Link href={`/contacts/${con.id}`} className="hover:text-blue-700">
                                <NavIcon icon={AB_ICONS.contact} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{con.full_name}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(m.status)}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-zinc-500 font-mono">
                            {m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* モバイル: カード */}
              <div className="md:hidden space-y-2">
                {g.records.map((m) => {
                  const acc = m.account?.id ? m.account : null
                  const con = m.contact?.id ? m.contact : null
                  const displayName = maintenanceDisplayName(m, acc, con, m.vehicle)
                  return (
                    <Link key={m.id} href={`/maintenance/${m.id}`}
                      className="block bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 active:bg-zinc-50/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-900 break-all">{displayName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(m.status)}`}>
                          {m.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-400 mt-1">整備No: {m.maintenance_no}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        入庫: {m.intake_date ?? '—'}
                        {m.delivery_date && <> · 納車: {m.delivery_date}</>}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
