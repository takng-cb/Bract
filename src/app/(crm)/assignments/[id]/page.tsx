/**
 * /assignments/[id] — 案件詳細 (Issue #69 Phase 1)
 *
 * 簡易版: 案件情報 + アサイン済みスタッフ一覧 + 粗利計算
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts, contacts, staff } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteAssignment } from '@/industries/staffing/actions/assignments'
import { assignmentStatusColor, calcAssignmentProfit } from '@/industries/staffing/lib/staffingService'

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params

  const [row, staffEntries] = await Promise.all([
    db.select({
      a:       assignments,
      client:  { id: accounts.id, name: accounts.name },
      contact: { id: contacts.id, full_name: contacts.full_name },
    })
      .from(assignments)
      .leftJoin(accounts, eq(assignments.client_account_id, accounts.id))
      .leftJoin(contacts, eq(assignments.client_contact_id, contacts.id))
      .where(eq(assignments.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:             assignment_staff.id,
      service_hours:  assignment_staff.service_hours,
      hourly_rate:    assignment_staff.hourly_rate,
      cost_per_hour:  assignment_staff.cost_per_hour,
      status:         assignment_staff.status,
      notes:          assignment_staff.notes,
      staff:          { id: staff.id, name: staff.name, name_kana: staff.name_kana },
    })
      .from(assignment_staff)
      .innerJoin(staff, eq(assignment_staff.staff_id, staff.id))
      .where(eq(assignment_staff.assignment_id, id)),
  ])

  if (!row) notFound()
  const a = row.a

  async function handleDelete() {
    'use server'
    await deleteAssignment(id)
  }

  // 粗利計算
  const { revenue, cost, profit } = calcAssignmentProfit(
    a.client_total_fee,
    staffEntries.map((s) => ({
      service_hours: s.service_hours != null ? Number(s.service_hours) : null,
      hourly_rate:   s.hourly_rate   != null ? Number(s.hourly_rate)   : null,
      cost_per_hour: s.cost_per_hour != null ? Number(s.cost_per_hour) : null,
    })),
  )

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Breadcrumbs items={[
        { label: '案件', href: '/assignments' },
        { label: a.assignment_no },
      ]} />

      <div className="flex items-start justify-between gap-3 mt-2 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-zinc-900 font-mono">{a.assignment_no}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs rounded ${assignmentStatusColor(a.status)}`}>{a.status}</span>
          </div>
          {row.client?.id && (
            <p className="text-sm text-zinc-600 mt-1">
              派遣先: <Link href={`/accounts/${row.client.id}`} className="text-blue-600 hover:underline">{row.client.name}</Link>
              {row.contact?.id && (
                <span className="ml-2">／ 担当: <Link href={`/contacts/${row.contact.id}`} className="text-blue-600 hover:underline">{row.contact.full_name}</Link></span>
              )}
            </p>
          )}
        </div>
        <AuthGuard minRole="editor">
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/assignments/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">✏️ 編集</Link>
            <DeleteButton action={handleDelete} confirmMessage="この案件を削除しますか？" />
          </div>
        </AuthGuard>
      </div>

      {/* 業務情報 */}
      <section className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">業務情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-zinc-400 mb-1">業務日</dt><dd>{a.service_date ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">時間</dt><dd>{a.service_start_time && a.service_end_time ? `${a.service_start_time} 〜 ${a.service_end_time}` : '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">業務区分</dt><dd>{a.service_type ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">場所</dt><dd>{a.service_location ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">募集人数</dt><dd>{a.staff_count_required ?? '—'} 名</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">アサイン済み</dt><dd>{staffEntries.length} 名</dd></div>
          {a.service_description && (
            <div className="sm:col-span-2"><dt className="text-xs text-zinc-400 mb-1">業務内容</dt><dd className="whitespace-pre-wrap">{a.service_description}</dd></div>
          )}
        </dl>
      </section>

      {/* アサイン済みスタッフ */}
      <section className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          アサイン済みスタッフ ({staffEntries.length} / {a.staff_count_required ?? '—'})
        </h2>
        {staffEntries.length === 0 ? (
          <p className="text-sm text-zinc-400">スタッフはまだアサインされていません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium text-zinc-600">スタッフ</th>
                <th className="text-right px-2 py-1.5 font-medium text-zinc-600">時間</th>
                <th className="text-right px-2 py-1.5 font-medium text-zinc-600">請求単価</th>
                <th className="text-right px-2 py-1.5 font-medium text-zinc-600">仕入単価</th>
                <th className="text-left px-2 py-1.5 font-medium text-zinc-600">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staffEntries.map((s) => (
                <tr key={s.id}>
                  <td className="px-2 py-1.5">
                    <Link href={`/staff/${s.staff.id}`} className="text-blue-600 hover:underline">{s.staff.name}</Link>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{s.service_hours ? `${s.service_hours}h` : '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{s.hourly_rate ? `¥${Number(s.hourly_rate).toLocaleString()}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{s.cost_per_hour ? `¥${Number(s.cost_per_hour).toLocaleString()}` : '—'}</td>
                  <td className="px-2 py-1.5"><span className={`inline-block px-1.5 py-0.5 text-[10px] rounded ${assignmentStatusColor(s.status)}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-zinc-400 mt-3">
          ※ スタッフのアサインは Phase 2 で UI 追加予定。現状は <code>/assignments/{id}/edit</code> でも管理可。
        </p>
      </section>

      {/* 粗利 */}
      <section className="bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">粗利計算</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-zinc-500 mb-1">売上 {a.client_total_fee ? '(請求総額)' : '(計算値)'}</dt>
            <dd className="font-mono text-lg font-bold text-zinc-800">¥{revenue.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">仕入 (スタッフ支払)</dt>
            <dd className="font-mono text-lg text-zinc-600">¥{cost.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">粗利</dt>
            <dd className={`font-mono text-lg font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              ¥{profit.toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      {a.internal_memo && (
        <section className="bg-white border border-zinc-200 rounded-lg p-6 mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-2">内部メモ</h2>
          <p className="text-sm text-zinc-800 whitespace-pre-wrap">{a.internal_memo}</p>
        </section>
      )}
    </div>
  )
}
