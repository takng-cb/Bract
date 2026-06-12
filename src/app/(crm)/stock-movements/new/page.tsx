/**
 * /stock-movements/new — 入出庫の登録 (Issue #48)
 *
 * レコード詳細ページと同じ見た目（REQ-0051）:
 * RecordHeader + RecordColumns（左=入出庫情報 dense / 右=対象・メモ）。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Boxes } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, warehouses } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import SubmitButton from '@/components/SubmitButton'
import RecordHeader from '@/components/RecordHeader'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import { createStockMovement } from '@/app/actions/inventory'
import { MOVEMENT_TYPES } from '@/lib/inventory'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const FORM_ID = 'record-create-form'

export default async function NewStockMovementPage({
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
    await createStockMovement(formData) // redirect('/stock-movements') 内包
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。登録はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: '在庫移動', href: '/stock-movements' }, { label: '入出庫を登録' }]}
        avatar={<Boxes className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="入出庫を登録"
        actions={
          productRows.length > 0 ? (
            <div className="flex items-center gap-2">
              <Link href="/stock-movements" className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
                キャンセル
              </Link>
              <button
                type="submit"
                form={FORM_ID}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                登録
              </button>
            </div>
          ) : undefined
        }
      />

      {productRows.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 text-sm text-zinc-500">
          先に <Link href="/products/new" className="text-blue-600 hover:underline">商品</Link> を登録してください。
        </div>
      ) : (
        <form id={FORM_ID} action={action}>
          <RecordColumns
            narrow
            left={
              <CreateInfoCard
                dense
                title="入出庫情報"
                fields={[
                  { label: '種別', name: 'movement_type', kind: 'select', required: true, defaultValue: '入庫', emptyOption: null, options: MOVEMENT_TYPES.map((m) => ({ value: m, label: m })) },
                  { label: '数量', name: 'quantity', kind: 'number', min: 1, required: true },
                  { label: '日付', name: 'occurred_at', kind: 'date', defaultValue: new Date().toISOString().slice(0, 10) },
                  { label: '単価', name: 'unit_price', kind: 'number', min: 0, step: 0.01 },
                  { label: '伝票番号', name: 'reference' },
                ]}
              />
            }
          >
            <CreateInfoCard title="対象" fields={[]}>
              <div className="space-y-4">
                <div>
                  <span className="block text-xs text-zinc-400 mb-1">
                    商品<span className="text-red-500"> *</span>
                  </span>
                  <SearchableSelect
                    name="product_id"
                    options={productRows.map((p) => ({ value: p.id, label: `${p.name}（${p.sku}）` }))}
                    defaultValue={sp.product_id ?? ''}
                    placeholder="— 商品を選択 —"
                  />
                </div>
                <div>
                  <span className="block text-xs text-zinc-400 mb-1">倉庫</span>
                  <SearchableSelect
                    name="warehouse_id"
                    options={warehouseRows.map((w) => ({ value: w.id, label: `${w.name}（${w.code}）` }))}
                    placeholder="— 倉庫を選択（任意）—"
                  />
                </div>
              </div>
            </CreateInfoCard>

            <CreateInfoCard
              title="メモ"
              fields={[{ label: 'メモ', name: 'note', kind: 'textarea', fullWidth: true }]}
            />
          </RecordColumns>

          {/* 登録/キャンセルはページ最下部（2カラムの外・全幅）に置く */}
          <div className="mt-6 flex justify-center gap-3 border-t border-zinc-200 pt-5">
            <SubmitButton>登録</SubmitButton>
            <Link href="/stock-movements" className="px-6 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
