/**
 * /warehouses 一覧 — inventory モジュール (Issue #48)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { warehouses } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { NavIcon } from '@/lib/navIcon'

export const dynamic = 'force-dynamic'

export default async function WarehousesListPage() {
  if (!(await isModuleEnabled('inventory'))) notFound()

  const [rows, edit] = await Promise.all([
    db.select({
      id: warehouses.id, code: warehouses.code, name: warehouses.name,
      location: warehouses.location,
    }).from(warehouses).orderBy(asc(warehouses.code)),
    canEdit(),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🏬" className="w-6 h-6" /> 倉庫</h1>
          <p className="text-sm text-zinc-500 mt-1">全 {rows.length} 件</p>
        </div>
        {edit && (
          <Link href="/warehouses/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            ＋ 新規追加
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="🏬" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">倉庫がまだ登録されていません</p>
          <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">コード</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">倉庫名</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">所在地</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.code}</td>
                  <td className="px-3 py-2">
                    <Link href={`/warehouses/${r.id}`} className="text-blue-600 hover:underline font-medium">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{r.location ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
