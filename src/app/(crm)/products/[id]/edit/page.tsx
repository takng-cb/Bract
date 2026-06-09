/**
 * /products/[id]/edit — 商品 編集 (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import { updateProduct } from '@/app/actions/inventory'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isModuleEnabled('inventory'))) notFound()
  await requireEditor()

  const [p, supplierAccounts] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
  ])
  if (!p) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateProduct(id, formData)
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/products" className="hover:text-zinc-600">商品</Link>
        <span className="mx-2">/</span>
        <Link href={`/products/${id}`} className="hover:text-zinc-600">{p.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">商品を編集</h1>

      <form action={action} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">SKU <span className="text-red-500">*</span></label>
            <input name="sku" required defaultValue={p.sku} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">商品名 <span className="text-red-500">*</span></label>
            <input name="name" required defaultValue={p.name} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">カテゴリ</label>
            <input name="category" defaultValue={p.category ?? ''} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">単位（個/箱/kg 等）</label>
            <input name="unit" defaultValue={p.unit ?? ''} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">売価</label>
            <input name="unit_price" type="number" min="0" step="0.01" defaultValue={p.unit_price ?? ''} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">原価</label>
            <input name="cost_price" type="number" min="0" step="0.01" defaultValue={p.cost_price ?? ''} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">発注しきい値</label>
            <input name="reorder_level" type="number" min="0" defaultValue={p.reorder_level ?? 0} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">主仕入元</label>
            <SearchableSelect
              name="supplier_account_id"
              options={supplierAccounts.map((a) => ({ value: a.id, label: a.name }))}
              defaultValue={p.supplier_account_id ?? ''}
              placeholder="— 取引先を選択 —"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">備考</label>
          <textarea name="description" rows={3} defaultValue={p.description ?? ''} className={field} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
          <Link href={`/products/${id}`} className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
        </div>
      </form>
    </div>
  )
}
