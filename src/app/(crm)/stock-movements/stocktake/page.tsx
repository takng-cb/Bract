/**
 * /stock-movements/stocktake — 棚卸（実在庫数に合わせて在庫を補正） (Issue #48)
 *
 * 商品・倉庫（任意）・実在庫数を入力して送信すると、applyStocktake が
 * 現在庫との差分を movement_type='調整' として記録し、補正後在庫を実在庫数に一致させる。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, warehouses } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import { applyStocktake } from '@/app/actions/inventory'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string }>
}) {
  await requireBookRead('stock_movements')  // RBAC: Read 権限ガード（ADR-0023）
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
    await applyStocktake(formData) // redirect(`/products/${id}`) 内包
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/stock-movements" className="hover:text-zinc-600">在庫移動</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">棚卸</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">棚卸</h1>
      <p className="text-sm text-zinc-500 mb-6">
        実在庫数を入力すると、現在庫との差分を「調整」として記録し、在庫を実数に合わせます。
      </p>

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
              placeholder="— 倉庫を選択（任意・未指定の在庫を対象）—"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">実在庫数 <span className="text-red-500">*</span></label>
            <input name="actual_qty" type="number" min="0" required className={field} />
            <p className="text-[11px] text-zinc-400 mt-1">数えた実際の在庫数を入力してください。現在庫との差分が「調整」として記録されます。</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">棚卸を反映</button>
            <Link href="/stock-movements" className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
          </div>
        </form>
      )}
    </div>
  )
}
