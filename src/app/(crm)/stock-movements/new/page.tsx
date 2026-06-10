/**
 * /stock-movements/new — 入出庫の登録 (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, warehouses } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import SubmitButton from '@/components/SubmitButton'
import { createStockMovement } from '@/app/actions/inventory'
import { MOVEMENT_TYPES } from '@/lib/inventory'

export const dynamic = 'force-dynamic'

export default async function NewStockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string }>
}) {
  if (!(await isModuleEnabled('inventory'))) notFound()
  await requireEditor()

  const [sp, productRows, warehouseRows] = await Promise.all([
    searchParams,
    db.select({ id: products.id, sku: products.sku, name: products.name })
      .from(products).orderBy(asc(products.sku)),
    db.select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses).orderBy(asc(warehouses.code)),
  ])

  async function action(formData: FormData) {
    'use server'
    await createStockMovement(formData) // redirect('/stock-movements') 内包
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/stock-movements" className="hover:text-zinc-600">在庫移動</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">入出庫を登録</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">入出庫を登録</h1>

      {productRows.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 text-sm text-zinc-500">
          先に <Link href="/products/new" className="text-blue-600 hover:underline">商品</Link> を登録してください。
        </div>
      ) : (
        <form action={action} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">商品 <span className="text-red-500">*</span></label>
            <SearchableSelect
              name="product_id"
              options={productRows.map((p) => ({ value: p.id, label: `${p.name}（${p.sku}）` }))}
              defaultValue={sp.product_id ?? ''}
              placeholder="— 商品を選択 —"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">倉庫</label>
            <SearchableSelect
              name="warehouse_id"
              options={warehouseRows.map((w) => ({ value: w.id, label: `${w.name}（${w.code}）` }))}
              placeholder="— 倉庫を選択（任意）—"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">種別 <span className="text-red-500">*</span></label>
              <select name="movement_type" required defaultValue="入庫" className={`${field} bg-white`}>
                {MOVEMENT_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">数量 <span className="text-red-500">*</span></label>
              <input name="quantity" type="number" min="1" required className={field} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">日付</label>
              <input name="occurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">単価</label>
              <input name="unit_price" type="number" min="0" step="0.01" className={field} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">伝票番号</label>
              <input name="reference" className={field} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">メモ</label>
            <textarea name="note" rows={2} className={field} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <SubmitButton>登録</SubmitButton>
            <Link href="/stock-movements" className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
          </div>
        </form>
      )}
    </div>
  )
}
