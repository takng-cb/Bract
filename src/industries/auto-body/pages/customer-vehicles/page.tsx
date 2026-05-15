import { db } from '@/lib/db'
import { customer_vehicles, accounts, maintenance_records } from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'

export default async function CustomerVehiclesListPage() {
  // RSC は 1 リクエストにつき 1 回しか render されないため Date.now() は安定。
  // react-hooks/purity は client component 向けの規則なのでここでは無効化する。
  // eslint-disable-next-line react-hooks/purity
  const nowTime = Date.now()

  const [rows, edit] = await Promise.all([
    db.select({
      id:                  customer_vehicles.id,
      plate_number:        customer_vehicles.plate_number,
      car_name:            customer_vehicles.car_name,
      car_model:           customer_vehicles.car_model,
      inspection_due_date: customer_vehicles.inspection_due_date,
      updated_at:          customer_vehicles.updated_at,
      account:             { id: accounts.id, name: accounts.name },
      maintenance_count:   sql<number>`(SELECT COUNT(*) FROM ${maintenance_records} WHERE ${maintenance_records.customer_vehicle_id} = ${customer_vehicles.id})`.as('maintenance_count'),
    })
      .from(customer_vehicles)
      .leftJoin(accounts, eq(customer_vehicles.account_id, accounts.id))
      .orderBy(desc(customer_vehicles.updated_at)),
    canEdit(),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">顧客車両</h1>
          <p className="text-sm text-zinc-500 mt-1">全 {rows.length} 台</p>
        </div>
        {edit && (
          <Link href="/customer-vehicles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            ＋ 新規登録
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🚗</p>
          <p className="text-lg font-medium">顧客車両がまだ登録されていません</p>
          <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>
        </div>
      ) : (
        <>
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
                {rows.map((v) => {
                  const days = v.inspection_due_date
                    ? Math.ceil((new Date(v.inspection_due_date).getTime() - nowTime) / 86400000)
                    : null
                  const urgent = days != null && days <= 30
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
                        {v.account?.id
                          ? <Link href={`/accounts/${v.account.id}`} className="hover:text-blue-600">{v.account.name}</Link>
                          : '—'}
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
            {rows.map((v) => (
              <Link key={v.id} href={`/customer-vehicles/${v.id}`}
                className="block bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                <p className="font-semibold text-zinc-900 text-sm">🚗 {v.plate_number ?? '—'}</p>
                <p className="text-xs text-zinc-500 mt-1">{[v.car_name, v.car_model].filter(Boolean).join(' / ')}</p>
                {v.account && <p className="text-xs text-zinc-500 mt-0.5">🏢 {v.account.name}</p>}
                <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                  <span>車検: {v.inspection_due_date ?? '—'}</span>
                  <span>整備 {Number(v.maintenance_count)} 件</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
