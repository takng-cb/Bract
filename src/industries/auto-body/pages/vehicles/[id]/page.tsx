import { db } from '@/lib/db'
import { vehicles } from '@/industries/auto-body/schema'
import { accounts, opportunities } from '@/lib/schema'
import { alias } from 'drizzle-orm/pg-core'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import ChangeLogSection from '@/components/ChangeLogSection'
import { deleteVehicle } from '@/industries/auto-body/actions/vehicles'
import {
  vehicleStatusColor,
  daysUntilInspection,
  calcAutoBodyProfit,
} from '@/industries/auto-body/lib/autoBodyService'

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = alias(accounts, 'supplier')
  const buyer    = alias(accounts, 'buyer')

  const [v] = await db.select({
    id:                   vehicles.id,
    maker:                vehicles.maker,
    model:                vehicles.model,
    year:                 vehicles.year,
    mileage:              vehicles.mileage,
    color:                vehicles.color,
    license_plate:        vehicles.license_plate,
    vin:                  vehicles.vin,
    status:               vehicles.status,
    purchase_date:        vehicles.purchase_date,
    purchase_price:       vehicles.purchase_price,
    sale_price:           vehicles.sale_price,
    sold_date:            vehicles.sold_date,
    sold_price:           vehicles.sold_price,
    next_inspection_date: vehicles.next_inspection_date,
    description:          vehicles.description,
    created_at:           vehicles.created_at,
    supplier: { id: supplier.id, name: supplier.name },
    buyer:    { id: buyer.id,    name: buyer.name },
  })
    .from(vehicles)
    .leftJoin(supplier, eq(vehicles.supplier_account_id, supplier.id))
    .leftJoin(buyer,    eq(vehicles.buyer_account_id, buyer.id))
    .where(eq(vehicles.id, id))

  if (!v) notFound()

  // 関連商談（service_type / amount / parts_cost を集計表示）
  const relatedOpps = await db.select({
    id:           opportunities.id,
    name:         opportunities.name,
    stage:        opportunities.stage,
    service_type: opportunities.service_type,
    amount:       opportunities.amount,
    parts_cost:   opportunities.parts_cost,
    close_date:   opportunities.close_date,
  })
    .from(opportunities)
    .where(eq(opportunities.vehicle_id, id))
    .orderBy(desc(opportunities.close_date))

  const totalProfit = relatedOpps.reduce(
    (s, o) => s + calcAutoBodyProfit(Number(o.amount ?? 0), Number(o.parts_cost ?? 0)),
    0,
  )

  const days = daysUntilInspection(v.next_inspection_date)
  const expiringSoon = days != null && days <= 30

  async function handleDelete() {
    'use server'
    await deleteVehicle(id)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[
          { label: '車両', href: '/vehicles' },
          { label: `${v.maker} ${v.model}` },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/vehicles/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この車両を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900">
          🚗 {v.maker} {v.model}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${vehicleStatusColor(v.status)}`}>{v.status}</span>
          {v.year   && <span>{v.year}年式</span>}
          {v.color  && <span>・ {v.color}</span>}
          {v.mileage != null && <span>・ {Number(v.mileage).toLocaleString()} km</span>}
        </div>
      </div>

      {/* 車両情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">車両情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">ナンバー</dt>
            <dd className="text-sm text-zinc-800">{v.license_plate ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">車台番号</dt>
            <dd className="text-sm text-zinc-800">{v.vin ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">次回車検</dt>
            <dd className={`text-sm ${expiringSoon ? 'text-red-600 font-semibold' : 'text-zinc-800'}`}>
              {v.next_inspection_date ?? '—'}
              {days != null && (
                <span className="ml-2 text-xs text-zinc-400">
                  ({days < 0 ? `${-days}日経過` : `あと${days}日`})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">
              {v.created_at ? new Date(v.created_at).toLocaleDateString('ja-JP') : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* 仕入・販売 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">仕入・販売</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入日</dt>
            <dd className="text-sm text-zinc-800">{v.purchase_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入価格</dt>
            <dd className="text-sm text-zinc-800">{v.purchase_price ? `¥${Number(v.purchase_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入元</dt>
            <dd className="text-sm text-zinc-800">
              {v.supplier?.id ? (
                <Link href={`/accounts/${v.supplier.id}`} className="text-blue-600 hover:underline">{v.supplier.name}</Link>
              ) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">希望売価</dt>
            <dd className="text-sm text-zinc-800">{v.sale_price ? `¥${Number(v.sale_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">売却日</dt>
            <dd className="text-sm text-zinc-800">{v.sold_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">売却価格</dt>
            <dd className="text-sm text-zinc-800">
              {v.sold_price ? <span className="font-semibold text-green-700">¥{Number(v.sold_price).toLocaleString()}</span> : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-400 mb-1">売却先</dt>
            <dd className="text-sm text-zinc-800">
              {v.buyer?.id ? (
                <Link href={`/accounts/${v.buyer.id}`} className="text-blue-600 hover:underline">{v.buyer.name}</Link>
              ) : '—'}
            </dd>
          </div>
        </dl>
        {v.purchase_price && v.sold_price && (
          <div className="mt-4 pt-4 border-t border-zinc-200 flex justify-between items-baseline">
            <span className="text-sm font-semibold text-zinc-700">車両単体粗利（売価 − 仕入）</span>
            <span className={`text-xl font-bold ${Number(v.sold_price) - Number(v.purchase_price) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              ¥{(Number(v.sold_price) - Number(v.purchase_price)).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 備考 */}
      {v.description && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-2">備考</h2>
          <p className="text-sm text-zinc-800 whitespace-pre-wrap">{v.description}</p>
        </div>
      )}

      {/* 関連サービス（商談） */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            関連サービス <span className="text-zinc-400 font-normal text-sm">({relatedOpps.length})</span>
          </h2>
          <AuthGuard minRole="editor">
            <Link href={`/opportunities/new?vehicle_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">
              ＋ 整備・修理・車検を追加
            </Link>
          </AuthGuard>
        </div>
        {relatedOpps.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">サービス</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">区分</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">完了予定</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">売上</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">部品原価</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">利益</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {relatedOpps.map((o) => {
                  const profit = calcAutoBodyProfit(Number(o.amount ?? 0), Number(o.parts_cost ?? 0))
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2">
                        <Link href={`/opportunities/${o.id}`} className="font-medium hover:text-blue-600">{o.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{o.service_type ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-500">{o.close_date ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-zinc-700">{o.amount ? `¥${Number(o.amount).toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">¥{Number(o.parts_cost ?? 0).toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-medium ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>¥{profit.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-zinc-600">利益合計</td>
                  <td className={`px-3 py-2 text-right font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>¥{totalProfit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">
            関連サービスがありません
          </p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">変更履歴</h2>
        <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
          <ChangeLogSection objectType="vehicle" objectId={id} />
        </div>
      </section>

      <div className="text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
