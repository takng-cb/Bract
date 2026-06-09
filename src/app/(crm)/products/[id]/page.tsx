/**
 * /products/[id] — 商品 詳細 (Issue #48)
 * RecordHeader ヒーロー（Package アバター）＋ 商品情報 ＋ 倉庫別在庫セクション。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Package, SquarePen } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { products, warehouses, stock_movements, accounts } from '@/lib/schema'
import { eq, desc, asc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { computeStockBalance, stockBadgeColor, isBelowReorder } from '@/lib/inventory'
import { deleteProduct } from '@/app/actions/inventory'
import { NavIcon } from '@/lib/navIcon'

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [productRow, movementRows, warehouseRows] = await Promise.all([
    db.select({
      id: products.id, sku: products.sku, name: products.name,
      category: products.category, unit: products.unit,
      unit_price: products.unit_price, cost_price: products.cost_price,
      reorder_level: products.reorder_level, description: products.description,
      created_at: products.created_at,
      supplier: { id: accounts.id, name: accounts.name },
    })
      .from(products)
      .leftJoin(accounts, eq(products.supplier_account_id, accounts.id))
      .where(eq(products.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:            stock_movements.id,
      warehouse_id:  stock_movements.warehouse_id,
      movement_type: stock_movements.movement_type,
      quantity:      stock_movements.quantity,
      unit_price:    stock_movements.unit_price,
      occurred_at:   stock_movements.occurred_at,
      reference:     stock_movements.reference,
      note:          stock_movements.note,
    })
      .from(stock_movements)
      .where(eq(stock_movements.product_id, id))
      .orderBy(desc(stock_movements.occurred_at), desc(stock_movements.created_at)),
    db.select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses).orderBy(asc(warehouses.code)),
  ])

  if (!productRow) notFound()

  const { total, byWarehouse } = computeStockBalance(movementRows)
  const warehouseName = new Map(warehouseRows.map((w) => [w.id, `${w.name}（${w.code}）`]))
  const unit = productRow.unit ? ` ${productRow.unit}` : ''

  async function handleDelete() {
    'use server'
    await deleteProduct(id)
  }

  // 倉庫別在庫（移動が存在するキーのみ）
  const perWarehouse = [...byWarehouse.entries()]
    .map(([wid, qty]) => ({
      wid,
      label: wid ? (warehouseName.get(wid) ?? '（不明な倉庫）') : '（倉庫未指定）',
      qty,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'))

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[{ label: '商品', href: '/products' }, { label: productRow.name }]}
        title={productRow.name}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} />}
        badges={
          <span className={`px-2.5 py-0.5 rounded text-sm font-bold ${stockBadgeColor(total, productRow.reorder_level ?? 0)}`}>
            在庫 {total}{unit}
          </span>
        }
        meta={[
          { label: 'SKU', value: productRow.sku, mono: true },
          ...(productRow.category ? [{ label: 'カテゴリ', value: productRow.category }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/products/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この商品を削除しますか？関連する在庫移動もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      {/* 発注点アラート */}
      {isBelowReorder(total, productRow.reorder_level ?? 0) && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-6 text-sm font-medium flex items-center gap-2">
          <span className="inline-block px-1.5 py-0.5 text-xs rounded font-bold bg-red-600 text-white">発注</span>
          発注点を下回っています（在庫 {total}{unit} / 発注点 {productRow.reorder_level}{unit}）
        </div>
      )}

      {/* 商品情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">商品情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">売価</dt>
            <dd className="text-sm text-zinc-800">{productRow.unit_price ? `¥${Number(productRow.unit_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">原価</dt>
            <dd className="text-sm text-zinc-800">{productRow.cost_price ? `¥${Number(productRow.cost_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">単位</dt>
            <dd className="text-sm text-zinc-800">{productRow.unit ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">発注しきい値</dt>
            <dd className="text-sm text-zinc-800">{productRow.reorder_level}{unit}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">主仕入元</dt>
            <dd className="text-sm text-zinc-800">
              {productRow.supplier?.id
                ? <Link href={`/accounts/${productRow.supplier.id}`} className="text-blue-600 hover:underline">{productRow.supplier.name}</Link>
                : '—'}
            </dd>
          </div>
        </dl>
        {productRow.description && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <dt className="text-xs text-zinc-400 mb-1">備考</dt>
            <dd className="text-sm text-zinc-800 whitespace-pre-wrap">{productRow.description}</dd>
          </div>
        )}
      </div>

      {/* 倉庫別在庫 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-700">倉庫別在庫</h2>
          <AuthGuard minRole="editor">
            <Link href="/stock-movements/new" className="text-xs text-blue-600 hover:text-blue-800">＋ 入出庫を登録</Link>
          </AuthGuard>
        </div>
        {perWarehouse.length === 0 ? (
          <p className="text-sm text-zinc-400">在庫移動がまだありません</p>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {perWarehouse.map((w) => (
              <div key={w.wid || '__none__'} className="flex items-baseline justify-between border-b border-zinc-100 pb-2">
                <dt className="text-sm text-zinc-600">{w.label}</dt>
                <dd className={`px-2 py-0.5 rounded text-sm font-semibold ${stockBadgeColor(w.qty, productRow.reorder_level ?? 0)}`}>{w.qty}{unit}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* 在庫移動履歴 */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">在庫移動履歴 <span className="text-zinc-400 font-normal text-sm">({movementRows.length})</span></h2>
        {movementRows.length === 0 ? (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">履歴がありません</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">日付</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">倉庫</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">種別</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">数量</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">伝票/メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {movementRows.map((m) => {
                  const sign = m.movement_type === '出庫' ? '−' : '＋'
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-700 whitespace-nowrap">{m.occurred_at}</td>
                      <td className="px-3 py-2 text-zinc-600">{m.warehouse_id ? (warehouseName.get(m.warehouse_id) ?? '—') : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          m.movement_type === '入庫' ? 'bg-blue-50 text-blue-700' :
                          m.movement_type === '出庫' ? 'bg-orange-50 text-orange-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>{m.movement_type}</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${m.movement_type === '出庫' ? 'text-orange-600' : 'text-zinc-700'}`}>
                        {sign} {m.quantity}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 truncate max-w-xs">
                        {[m.reference, m.note].filter(Boolean).join(' / ') || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 text-right text-xs text-zinc-400 font-mono">
        <NavIcon icon="📦" className="w-3 h-3 inline mr-1" />{id}
      </div>
    </div>
  )
}
