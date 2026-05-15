import { db } from '@/lib/db'
import { maintenance_records, customer_vehicles, accounts } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'

const STATUS_COLOR: Record<string, string> = {
  '予約':     'bg-zinc-100 text-zinc-700',
  '受付':     'bg-blue-50 text-blue-700',
  '作業中':   'bg-yellow-50 text-yellow-700',
  '納車待ち': 'bg-orange-50 text-orange-700',
  '完了':     'bg-green-50 text-green-700',
  'キャンセル': 'bg-red-50 text-red-700',
}

export default async function MaintenanceListPage() {
  const [rows, edit] = await Promise.all([
    db.select({
      id:             maintenance_records.id,
      maintenance_no: maintenance_records.maintenance_no,
      intake_date:    maintenance_records.intake_date,
      delivery_date:  maintenance_records.delivery_date,
      status:         maintenance_records.status,
      mileage:        maintenance_records.mileage,
      vehicle: {
        id:           customer_vehicles.id,
        plate_number: customer_vehicles.plate_number,
        car_model:    customer_vehicles.car_model,
      },
      account: { id: accounts.id, name: accounts.name },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .orderBy(desc(maintenance_records.intake_date), desc(maintenance_records.created_at)),
    canEdit(),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">整備</h1>
          <p className="text-sm text-zinc-500 mt-1">全 {rows.length} 件</p>
        </div>
        {edit && (
          <Link href="/maintenance/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            ＋ 整備を作成
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🔧</p>
          <p className="text-lg font-medium">整備がまだ登録されていません</p>
          <p className="text-sm mt-1">「整備を作成」ボタンから追加してください</p>
        </div>
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">整備No</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">入庫日</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">納車日</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">車両</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">顧客</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">ステータス</th>
                  <th className="text-right px-4 py-2 font-medium text-zinc-600">走行距離</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 font-mono">
                      <Link href={`/maintenance/${m.id}`} className="text-blue-600 hover:underline">{m.maintenance_no}</Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">{m.intake_date ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-700">{m.delivery_date ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      {m.vehicle?.id ? (
                        <Link href={`/customer-vehicles/${m.vehicle.id}`} className="hover:text-blue-600">
                          🚗 {m.vehicle.plate_number ?? m.vehicle.car_model ?? '—'}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {m.account?.id ? (
                        <Link href={`/accounts/${m.account.id}`} className="hover:text-blue-600">{m.account.name}</Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500">
                      {m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {rows.map((m) => (
              <Link key={m.id} href={`/maintenance/${m.id}`}
                className="block bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-zinc-900">{m.maintenance_no}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  🚗 {m.vehicle?.plate_number ?? m.vehicle?.car_model ?? '—'}
                  {m.account?.name && <> · 🏢 {m.account.name}</>}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  入庫: {m.intake_date ?? '—'}
                  {m.delivery_date && <> · 納車: {m.delivery_date}</>}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
