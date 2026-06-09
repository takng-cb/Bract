/**
 * /warehouses/[id] — 倉庫 詳細 (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Warehouse, SquarePen } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { warehouses, stock_movements, products } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { computeStockBalance } from '@/lib/inventory'
import { deleteWarehouse } from '@/app/actions/inventory'

export const dynamic = 'force-dynamic'

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [w, rows] = await Promise.all([
    db.select().from(warehouses).where(eq(warehouses.id, id)).then((r) => r[0] ?? null),
    db.select({
      product_id:    stock_movements.product_id,
      product_name:  products.name,
      product_sku:   products.sku,
      movement_type: stock_movements.movement_type,
      quantity:      stock_movements.quantity,
    })
      .from(stock_movements)
      .leftJoin(products, eq(stock_movements.product_id, products.id))
      .where(eq(stock_movements.warehouse_id, id))
      .orderBy(asc(products.sku)),
  ])
  if (!w) notFound()

  // 商品ごとに在庫を集計（この倉庫内）
  const byProduct = new Map<string, { name: string; sku: string; movements: { movement_type: string; quantity: number | null }[] }>()
  for (const r of rows) {
    const entry = byProduct.get(r.product_id) ?? { name: r.product_name ?? '（不明）', sku: r.product_sku ?? '', movements: [] }
    entry.movements.push({ movement_type: r.movement_type, quantity: r.quantity })
    byProduct.set(r.product_id, entry)
  }
  const stockList = [...byProduct.entries()]
    .map(([pid, e]) => ({ pid, name: e.name, sku: e.sku, qty: computeStockBalance(e.movements).total }))
    .filter((e) => e.qty !== 0)

  async function handleDelete() {
    'use server'
    await deleteWarehouse(id)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[{ label: '倉庫', href: '/warehouses' }, { label: w.name }]}
        title={w.name}
        avatar={<Warehouse className="w-6 h-6" strokeWidth={2.25} />}
        meta={[{ label: 'コード', value: w.code, mono: true }]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/warehouses/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この倉庫を削除しますか？在庫移動の倉庫参照は空になります（履歴は残ります）。" />
            </div>
          </AuthGuard>
        }
      />

      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">倉庫情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">所在地</dt>
            <dd className="text-sm text-zinc-800">{w.location ?? '—'}</dd>
          </div>
        </dl>
        {w.note && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <dt className="text-xs text-zinc-400 mb-1">備考</dt>
            <dd className="text-sm text-zinc-800 whitespace-pre-wrap">{w.note}</dd>
          </div>
        )}
      </div>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">この倉庫の在庫 <span className="text-zinc-400 font-normal text-sm">({stockList.length})</span></h2>
        {stockList.length === 0 ? (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">在庫がありません</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">SKU</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">商品名</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">在庫</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stockList.map((s) => (
                  <tr key={s.pid} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{s.sku}</td>
                    <td className="px-3 py-2">
                      <Link href={`/products/${s.pid}`} className="text-blue-600 hover:underline font-medium">{s.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-700">{s.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
