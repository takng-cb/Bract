/**
 * /products/new — 商品 新規作成 (Issue #48)
 *
 * レコード詳細ページと同じ見た目（REQ-0051）:
 * RecordHeader + RecordColumns（左=商品情報 dense / 右=基本情報）。
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import RecordHeader from '@/components/RecordHeader'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import { createProduct } from '@/app/actions/inventory'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const FORM_ID = 'record-create-form'

export default async function NewProductPage() {
  await requireBookRead('products')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('inventory'))) notFound()
  await requireEditor()

  const supplierAccounts = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name))

  async function action(formData: FormData) {
    'use server'
    const id = await createProduct(formData)
    redirect(`/products/${id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: '商品', href: '/products' }, { label: '新規作成' }]}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="商品を追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/products" className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form={FORM_ID}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        }
      />

      <form id={FORM_ID} action={action}>
        <RecordColumns
          narrow
          left={
            <CreateInfoCard
              dense
              title="商品情報"
              fields={[
                { label: 'SKU', name: 'sku', required: true },
                { label: 'カテゴリ', name: 'category' },
                { label: '単位（個/箱/kg 等）', name: 'unit' },
                { label: '売価', name: 'unit_price', kind: 'number', min: 0 },
                { label: '原価', name: 'cost_price', kind: 'number', min: 0 },
                { label: '発注しきい値', name: 'reorder_level', kind: 'number', min: 0, defaultValue: 0 },
              ]}
            >
              <div>
                <span className="block text-[12px] text-zinc-500 mb-1">主仕入元</span>
                <SearchableSelect
                  name="supplier_account_id"
                  options={supplierAccounts.map((a) => ({ value: a.id, label: a.name }))}
                  placeholder="— 取引先を選択 —"
                />
              </div>
            </CreateInfoCard>
          }
        >
          <CreateInfoCard
            title="基本情報"
            fields={[
              { label: '商品名', name: 'name', required: true, fullWidth: true },
              { label: '備考', name: 'description', kind: 'textarea', fullWidth: true },
            ]}
          />
        </RecordColumns>

        {/* 保存/キャンセルはページ最下部（2カラムの外・全幅）に置く */}
        <div className="mt-6 flex justify-center gap-3 border-t border-zinc-200 pt-5">
          <button
            type="submit"
            className="px-8 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
          <Link href="/products" className="px-6 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
