/**
 * /stock-movements 一覧 — inventory モジュール (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { stock_movements, products, warehouses } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { NavIcon } from '@/lib/navIcon'

export const dynamic = 'force-dynamic'

export default async function StockMovementsListPage() {
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [rows, edit] = await Promise.all([
    db.select({
      id:            stock_movements.id,
      occurred_at:   stock_movements.occurred_at,
      movement_type: stock_movements.movement_type,
      quantity:      stock_movements.quantity,
      reference:     stock_movements.reference,
      product:       { id: products.id, name: products.name, sku: products.sku },
      warehouse:     { id: warehouses.id, name: warehouses.name },
    })
      .from(stock_movements)
      .leftJoin(products, eq(stock_movements.product_id, products.id))
      .leftJoin(warehouses, eq(stock_movements.warehouse_id, warehouses.id))
      .orderBy(desc(stock_movements.occurred_at), desc(stock_movements.created_at)),
    canEdit(),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🔁" className="w-6 h-6" /> 在庫移動</h1>
          <p className="text-sm text-zinc-500 mt-1">全 {rows.length} 件</p>
        </div>
        {edit && (
          <Link href="/stock-movements/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            ＋ 入出庫を登録
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="🔁" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">在庫移動がまだ登録されていません</p>
          <p className="text-sm mt-1">「入出庫を登録」ボタンから記録してください</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">日付</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">商品</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">倉庫</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">種別</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">数量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => {
                const sign = r.movement_type === '出庫' ? '−' : '＋'
                return (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 text-zinc-700 whitespace-nowrap">{r.occurred_at}</td>
                    <td className="px-3 py-2">
                      {r.product?.id ? (
                        <Link href={`/products/${r.product.id}`} className="text-blue-600 hover:underline font-medium">{r.product.name}</Link>
                      ) : '—'}
                      {r.product?.sku && <span className="block text-[11px] text-zinc-400 font-mono">{r.product.sku}</span>}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {r.warehouse?.id ? (
                        <Link href={`/warehouses/${r.warehouse.id}`} className="hover:text-blue-600">{r.warehouse.name}</Link>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        r.movement_type === '入庫' ? 'bg-blue-50 text-blue-700' :
                        r.movement_type === '出庫' ? 'bg-orange-50 text-orange-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>{r.movement_type}</span>
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${r.movement_type === '出庫' ? 'text-orange-600' : 'text-zinc-700'}`}>
                      {sign} {r.quantity}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
