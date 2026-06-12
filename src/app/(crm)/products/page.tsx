/**
 * /products 一覧 — inventory モジュール (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { products, stock_movements } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { computeStockBalance, stockBadgeColor, isBelowReorder } from '@/lib/inventory'
import { NavIcon } from '@/lib/navIcon'
import CsvToolbar from '@/components/CsvToolbar'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function ProductsListPage() {
  await requireBookRead('products')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [rows, movements, edit] = await Promise.all([
    db.select({
      id:            products.id,
      sku:           products.sku,
      name:          products.name,
      category:      products.category,
      unit:          products.unit,
      unit_price:    products.unit_price,
      reorder_level: products.reorder_level,
    }).from(products).orderBy(asc(products.sku)),
    db.select({
      product_id:    stock_movements.product_id,
      movement_type: stock_movements.movement_type,
      quantity:      stock_movements.quantity,
    }).from(stock_movements),
    canEdit(),
  ])

  // product_id ごとに在庫合計を算出
  const byProduct = new Map<string, { movement_type: string; quantity: number | null }[]>()
  for (const m of movements) {
    const arr = byProduct.get(m.product_id) ?? []
    arr.push({ movement_type: m.movement_type, quantity: m.quantity })
    byProduct.set(m.product_id, arr)
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="📦" className="w-6 h-6" /> 商品</h1>
          <p className="text-sm text-zinc-500 mt-1">全 {rows.length} 件</p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/products"
            importUrl="/api/import/products"
            label="商品"
            csvFormat="ID,SKU,商品名,カテゴリ,単位,売価,原価,発注しきい値,備考"
            showImport={edit}
            filterFields={[
              { value: 'sku',           label: 'SKU',          type: 'text' },
              { value: 'name',          label: '商品名',       type: 'text' },
              { value: 'category',      label: 'カテゴリ',     type: 'text' },
              { value: 'unit',          label: '単位',         type: 'text' },
              { value: 'unit_price',    label: '売価（円）',   type: 'number' },
              { value: 'cost_price',    label: '原価（円）',   type: 'number' },
              { value: 'reorder_level', label: '発注しきい値', type: 'number' },
            ]}
          />
          {edit && (
            <Link href="/products/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              ＋ 新規追加
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="📦" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">商品がまだ登録されていません</p>
          <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">商品名</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">SKU</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">カテゴリ</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">売価</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">在庫合計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => {
                const { total } = computeStockBalance(byProduct.get(r.id) ?? [])
                return (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <Link href={`/products/${r.id}`} className="text-blue-600 hover:underline font-medium">{r.name}</Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.sku}</td>
                    <td className="px-3 py-2 text-zinc-600">{r.category ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-zinc-700 font-mono">
                      {r.unit_price ? `¥${Number(r.unit_price).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded font-semibold ${stockBadgeColor(total, r.reorder_level ?? 0)}`}>
                        {total}{r.unit ? ` ${r.unit}` : ''}
                      </span>
                      {isBelowReorder(total, r.reorder_level ?? 0) && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.5 text-xs rounded font-bold bg-red-600 text-white">発注</span>
                      )}
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
