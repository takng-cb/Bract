/**
 * /warehouses/new — 倉庫 新規作成 (Issue #48)
 *
 * レコード詳細ページと同じ見た目（REQ-0051）:
 * RecordHeader + RecordColumns（左=倉庫情報 dense / 右=基本情報）。
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Warehouse } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import { createWarehouse } from '@/app/actions/inventory'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const FORM_ID = 'record-create-form'

export default async function NewWarehousePage() {
  await requireBookRead('warehouses')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('inventory'))) notFound()
  await requireEditor()

  async function action(formData: FormData) {
    'use server'
    const id = await createWarehouse(formData)
    redirect(`/warehouses/${id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: '倉庫', href: '/warehouses' }, { label: '新規作成' }]}
        avatar={<Warehouse className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="倉庫を追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/warehouses" className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
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
              title="倉庫情報"
              fields={[
                { label: '倉庫コード', name: 'code', required: true },
                { label: '所在地', name: 'location' },
              ]}
            />
          }
        >
          <CreateInfoCard
            title="基本情報"
            fields={[
              { label: '倉庫名', name: 'name', required: true, fullWidth: true },
              { label: '備考', name: 'note', kind: 'textarea', fullWidth: true },
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
          <Link href="/warehouses" className="px-6 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
