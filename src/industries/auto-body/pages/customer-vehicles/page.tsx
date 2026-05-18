import { db } from '@/lib/db'
import { customer_vehicles, accounts, contacts, maintenance_records } from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, buildWhere, type FilterColumnResolver,
} from '@/lib/filterUtils'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'

const VEHICLE_KINDS = ['軽', '小型', '普通']
const VEHICLE_USAGES = ['乗用', '貨物']

export default async function CustomerVehiclesListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  // RSC は 1 リクエストにつき 1 回しか render されないため Date.now() は安定。
  // eslint-disable-next-line react-hooks/purity
  const nowTime = Date.now()

  const sp = await searchParams
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0

  // フィルター解決マップ
  const resolver: FilterColumnResolver = {
    plate_number:        { col: customer_vehicles.plate_number,        type: 'text' },
    car_name:            { col: customer_vehicles.car_name,            type: 'text' },
    car_model:           { col: customer_vehicles.car_model,           type: 'text' },
    vehicle_kind:        { col: customer_vehicles.vehicle_kind,        type: 'select' },
    vehicle_usage:       { col: customer_vehicles.vehicle_usage,       type: 'select' },
    inspection_due_date: { col: customer_vehicles.inspection_due_date, type: 'date' },
    account_id:          { col: customer_vehicles.account_id,          type: 'select' },
    owner_id:            { col: customer_vehicles.owner_id,            type: 'select' },
  }
  const conditions = parseFilterParams(filterRaw)
  const where = buildWhere(conditions, resolver)

  const [rows, edit, allUsers, allAccounts] = await Promise.all([
    db.select({
      id:                  customer_vehicles.id,
      plate_number:        customer_vehicles.plate_number,
      car_name:            customer_vehicles.car_name,
      car_model:           customer_vehicles.car_model,
      vehicle_kind:        customer_vehicles.vehicle_kind,
      vehicle_usage:       customer_vehicles.vehicle_usage,
      inspection_due_date: customer_vehicles.inspection_due_date,
      account_id:          customer_vehicles.account_id,
      contact_id:          customer_vehicles.contact_id,
      owner_id:            customer_vehicles.owner_id,
      updated_at:          customer_vehicles.updated_at,
      account:             { id: accounts.id, name: accounts.name },
      contact:             { id: contacts.id, full_name: contacts.full_name },
      maintenance_count:   sql<number>`(SELECT COUNT(*) FROM ${maintenance_records} WHERE ${maintenance_records.customer_vehicle_id} = ${customer_vehicles.id})`.as('maintenance_count'),
    })
      .from(customer_vehicles)
      .leftJoin(accounts, eq(customer_vehicles.account_id, accounts.id))
      .leftJoin(contacts, eq(customer_vehicles.contact_id, contacts.id))
      .where(where ?? sql`true`)
      .orderBy(desc(customer_vehicles.updated_at)),
    canEdit(),
    getAllUsers(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(accounts.name),
  ])

  // FIELDS（フィルター UI 用）
  const FIELDS: FieldDef[] = [
    { value: 'plate_number', label: 'ナンバー', type: 'text' },
    { value: 'car_name',     label: '車名',     type: 'text' },
    { value: 'car_model',    label: '車種',     type: 'text' },
    {
      value: 'vehicle_kind', label: '種別', type: 'select',
      options: VEHICLE_KINDS.map((v) => ({ value: v, label: v })),
    },
    {
      value: 'vehicle_usage', label: '用途', type: 'select',
      options: VEHICLE_USAGES.map((v) => ({ value: v, label: v })),
    },
    { value: 'inspection_due_date', label: '車検満了日', type: 'date' },
    {
      value: 'account_id', label: '取引先', type: 'select',
      options: allAccounts.map((a) => ({ value: a.id, label: a.name })),
    },
    {
      value: 'owner_id', label: '担当者', type: 'select',
      options: allUsers.map((u) => ({ value: u.id, label: u.name })),
    },
  ]
  const groupableFields = FIELDS
    .filter((f) => ['vehicle_kind', 'vehicle_usage', 'account_id', 'owner_id'].includes(f.value))
    .map((f) => ({ key: f.value, label: f.label }))

  const hasFilter = conditions.length > 0
  const totalCount = rows.length

  // グルーピング
  type Row = typeof rows[number]
  const groupedRows: { label: string; records: Row[] }[] = (() => {
    if (!isGrouped) return [{ label: '', records: rows }]
    const groupField = groupBy[0]  // 第1グループのみで簡易グルーピング
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      let raw: string | null = null
      if (groupField === 'account_id') {
        raw = r.account?.id ?? null
      } else if (groupField === 'owner_id') {
        raw = r.owner_id ?? null
      } else if (groupField === 'vehicle_kind') {
        raw = r.vehicle_kind ?? null
      } else if (groupField === 'vehicle_usage') {
        raw = r.vehicle_usage ?? null
      }
      const key = raw ?? '__null__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).map(([key, records]) => {
      let label = '（未設定）'
      if (groupField === 'account_id' && key !== '__null__') {
        label = allAccounts.find((a) => a.id === key)?.name ?? '（不明）'
      } else if (groupField === 'owner_id' && key !== '__null__') {
        label = allUsers.find((u) => u.id === key)?.name ?? '（不明）'
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
          <h1 className="text-2xl font-bold text-zinc-900">顧客車両</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 台
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        {edit && (
          <Link href="/customer-vehicles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            ＋ 新規登録
          </Link>
        )}
      </div>

      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/customer-vehicles"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🚗</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する車両がありません' : '顧客車両がまだ登録されていません'}
          </p>
          {hasFilter
            ? <Link href="/customer-vehicles" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>
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
                      <th className="text-left px-4 py-2 font-medium text-zinc-600">ナンバー</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-600">車名 / 車種</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-600">顧客</th>
                      <th className="text-left px-4 py-2 font-medium text-zinc-600">車検満了日</th>
                      <th className="text-right px-4 py-2 font-medium text-zinc-600">整備履歴</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {g.records.map((v) => {
                      const days = v.inspection_due_date
                        ? Math.ceil((new Date(v.inspection_due_date).getTime() - nowTime) / 86400000)
                        : null
                      const urgent = days != null && days <= 30
                      const acc = v.account?.id ? v.account : null
                      const con = v.contact?.id ? v.contact : null
                      return (
                        <tr key={v.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-2 font-medium">
                            <Link href={`/customer-vehicles/${v.id}`} className="hover:text-blue-600">
                              🚗 {v.plate_number ?? '—'}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-zinc-700">
                            {[v.car_name, v.car_model].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="px-4 py-2 text-zinc-600">
                            {acc && !isPersonalAccount(acc) ? (
                              <Link href={`/accounts/${acc.id}`} className="hover:text-blue-600">
                                {AB_ICONS.account} {acc.name}
                              </Link>
                            ) : con ? (
                              <Link href={`/contacts/${con.id}`} className="hover:text-blue-600">
                                {AB_ICONS.contact} {con.full_name}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className={`px-4 py-2 ${urgent ? 'text-red-600 font-semibold' : 'text-zinc-600'}`}>
                            {v.inspection_due_date ?? '—'}
                            {days != null && (
                              <span className="ml-2 text-xs text-zinc-400">
                                ({days < 0 ? `${-days}日経過` : `あと${days}日`})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-zinc-500">{Number(v.maintenance_count)} 件</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* モバイル: カード */}
              <div className="md:hidden space-y-2">
                {g.records.map((v) => {
                  const acc = v.account?.id ? v.account : null
                  const con = v.contact?.id ? v.contact : null
                  return (
                    <Link key={v.id} href={`/customer-vehicles/${v.id}`}
                      className="block bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                      <p className="font-semibold text-zinc-900 text-sm">🚗 {v.plate_number ?? '—'}</p>
                      <p className="text-xs text-zinc-500 mt-1">{[v.car_name, v.car_model].filter(Boolean).join(' / ')}</p>
                      {acc && !isPersonalAccount(acc) ? (
                        <p className="text-xs text-zinc-500 mt-0.5">🏢 {acc.name}</p>
                      ) : con ? (
                        <p className="text-xs text-zinc-500 mt-0.5">👤 {con.full_name}</p>
                      ) : null}
                      <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                        <span>車検: {v.inspection_due_date ?? '—'}</span>
                        <span>整備 {Number(v.maintenance_count)} 件</span>
                      </div>
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
