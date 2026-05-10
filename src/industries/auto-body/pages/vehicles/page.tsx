import { db } from '@/lib/db'
import { vehicles } from '@/industries/auto-body/schema'
import { accounts } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import AuthGuard from '@/components/AuthGuard'
import CsvToolbar from '@/components/CsvToolbar'
import {
  vehicleStatusColor,
  daysUntilInspection,
  VEHICLE_STATUSES,
} from '@/industries/auto-body/lib/autoBodyService'

export default async function VehiclesListPage() {
  const [rows, edit] = await Promise.all([
    db.select({
      id:                   vehicles.id,
      maker:                vehicles.maker,
      model:                vehicles.model,
      year:                 vehicles.year,
      mileage:              vehicles.mileage,
      license_plate:        vehicles.license_plate,
      status:               vehicles.status,
      purchase_price:       vehicles.purchase_price,
      sale_price:           vehicles.sale_price,
      sold_price:           vehicles.sold_price,
      next_inspection_date: vehicles.next_inspection_date,
      buyer_account: { name: accounts.name },
    })
      .from(vehicles)
      .leftJoin(accounts, eq(vehicles.buyer_account_id, accounts.id))
      .orderBy(desc(vehicles.created_at)),
    canEdit(),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">🚗 車両</h1>
          <p className="text-sm text-zinc-500 mt-1">
            在庫・販売済・整備中の車両一覧（{rows.length} 件）
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/vehicles"
            importUrl="/api/import/vehicles"
            label="車両"
            csvFormat="ID,メーカー,車種,年式,走行距離(km),色,ナンバー,車台番号,状態,仕入日,仕入価格,仕入元,希望売価,売却日,売却価格,売却先,次回車検期日,備考"
            fieldOptions={{
              '状態': [...VEHICLE_STATUSES],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/vehicles/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              ＋ 新規追加
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg px-6 py-12 text-center text-sm text-zinc-400">
          まだ車両が登録されていません
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">車両</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">ナンバー</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">状態</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">仕入</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">売価/売却</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">次回車検</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((v) => {
                const days = daysUntilInspection(v.next_inspection_date)
                const expiringSoon = days != null && days <= 30
                const sold = v.status === '販売済' || v.sold_price != null
                return (
                  <tr key={v.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <Link href={`/vehicles/${v.id}`} className="font-medium hover:text-blue-600 block">
                        {v.maker} {v.model}
                      </Link>
                      <span className="text-xs text-zinc-400">
                        {v.year ? `${v.year}年式` : ''}
                        {v.year && v.mileage ? ' / ' : ''}
                        {v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{v.license_plate ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${vehicleStatusColor(v.status)}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-700">
                      {v.purchase_price ? `¥${Number(v.purchase_price).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {sold && v.sold_price ? (
                        <span className="font-medium text-green-700">¥{Number(v.sold_price).toLocaleString()}</span>
                      ) : v.sale_price ? (
                        <span className="text-zinc-700">¥{Number(v.sale_price).toLocaleString()}</span>
                      ) : '—'}
                      {sold && v.buyer_account?.name && (
                        <div className="text-xs text-zinc-400 truncate">{v.buyer_account.name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {v.next_inspection_date ? (
                        <span className={expiringSoon ? 'text-red-600 font-medium' : ''}>
                          {v.next_inspection_date}
                          {days != null && (
                            <span className="text-xs text-zinc-400 ml-1">
                              ({days < 0 ? `${-days}日経過` : `あと${days}日`})
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <AuthGuard minRole="editor">
        <div />
      </AuthGuard>
    </div>
  )
}
