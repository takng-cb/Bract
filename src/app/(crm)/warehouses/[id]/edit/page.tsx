/**
 * /warehouses/[id]/edit — 倉庫 編集 (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { warehouses } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { updateWarehouse } from '@/app/actions/inventory'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('warehouses')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  if (!(await isModuleEnabled('inventory'))) notFound()
  await requireEditor()

  const w = await db.select().from(warehouses).where(eq(warehouses.id, id)).then((r) => r[0] ?? null)
  if (!w) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateWarehouse(id, formData)
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/warehouses" className="hover:text-zinc-600">倉庫</Link>
        <span className="mx-2">/</span>
        <Link href={`/warehouses/${id}`} className="hover:text-zinc-600">{w.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">倉庫を編集</h1>

      <form action={action} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">倉庫コード <span className="text-red-500">*</span></label>
            <input name="code" required defaultValue={w.code} className={field} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">倉庫名 <span className="text-red-500">*</span></label>
            <input name="name" required defaultValue={w.name} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">所在地</label>
            <input name="location" defaultValue={w.location ?? ''} className={field} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">備考</label>
          <textarea name="note" rows={3} defaultValue={w.note ?? ''} className={field} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
          <Link href={`/warehouses/${id}`} className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
        </div>
      </form>
    </div>
  )
}
