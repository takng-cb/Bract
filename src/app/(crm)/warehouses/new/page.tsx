/**
 * /warehouses/new — 倉庫 新規作成 (Issue #48)
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { createWarehouse } from '@/app/actions/inventory'

export const dynamic = 'force-dynamic'

export default async function NewWarehousePage() {
  if (!(await isModuleEnabled('inventory'))) notFound()
  await requireEditor()

  async function action(formData: FormData) {
    'use server'
    const id = await createWarehouse(formData)
    redirect(`/warehouses/${id}`)
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/warehouses" className="hover:text-zinc-600">倉庫</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規追加</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">倉庫を追加</h1>

      <form action={action} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">倉庫コード <span className="text-red-500">*</span></label>
            <input name="code" required className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">倉庫名 <span className="text-red-500">*</span></label>
            <input name="name" required className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">所在地</label>
            <input name="location" className={field} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">備考</label>
          <textarea name="note" rows={3} className={field} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
          <Link href="/warehouses" className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
        </div>
      </form>
    </div>
  )
}
