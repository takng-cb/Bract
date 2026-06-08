/**
 * /assignments 一覧 — staffing 業種専用 (Issue #69 Phase 1)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts } from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { assignmentStatusColor } from '@/industries/staffing/lib/staffingService'

export const dynamic = 'force-dynamic'

export default async function AssignmentsListPage() {
  if (!(await isModuleEnabled('staffing'))) notFound()

  const [rows, edit] = await Promise.all([
    db.select({
      id:                 assignments.id,
      assignment_no:      assignments.assignment_no,
      title:              assignments.title,
      service_date:       assignments.service_date,
      service_location:   assignments.service_location,
      service_type:       assignments.service_type,
      staff_count_required: assignments.staff_count_required,
      status:             assignments.status,
      client_total_fee:   assignments.client_total_fee,
      client:             { id: accounts.id, name: accounts.name },
      assigned_count:     sql<number>`(SELECT COUNT(*)::int FROM ${assignment_staff} WHERE ${assignment_staff.assignment_id} = ${assignments.id})`,
    })
      .from(assignments)
      .leftJoin(accounts, eq(assignments.client_account_id, accounts.id))
      .orderBy(desc(assignments.service_date), desc(assignments.created_at)),
    canEdit(),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">📋 案件</h1>
          <p className="text-sm text-zinc-500 mt-1">全 {rows.length} 件</p>
        </div>
        {edit && (
          <Link href="/assignments/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            ＋ 新規追加
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-lg font-medium">案件がまだ登録されていません</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">案件No</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">業務日</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">派遣先</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">業務区分</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">場所</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">アサイン</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">請求総額</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-600">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <Link href={`/assignments/${r.id}`} className="text-blue-600 hover:underline font-medium">{r.title ?? r.assignment_no}</Link>
                    {r.title && <span className="block text-[11px] text-zinc-400 font-mono">{r.assignment_no}</span>}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 whitespace-nowrap">{r.service_date ?? '—'}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {r.client?.id ? (
                      <Link href={`/accounts/${r.client.id}`} className="hover:text-blue-600">{r.client.name}</Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{r.service_type ?? '—'}</td>
                  <td className="px-3 py-2 text-zinc-600 truncate max-w-xs">{r.service_location ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 font-mono text-xs">
                    {r.assigned_count} / {r.staff_count_required ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-700 font-mono">
                    {r.client_total_fee ? `¥${Number(r.client_total_fee).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${assignmentStatusColor(r.status)}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
