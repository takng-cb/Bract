/**
 * /staff/[id] — スタッフ詳細 (Issue #69)
 */
import { notFound } from 'next/navigation'
import { SquarePen, UserRound } from 'lucide-react'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { staff, accounts, assignment_staff, assignments } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteStaff, setStaffStatus } from '@/industries/staffing/actions/staff'
import { assignmentStatusColor } from '@/industries/staffing/lib/staffingService'
import StageBar from '@/components/StageBar'
import { STAFF_STAGES } from '@/lib/statusStages'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params

  const [row, history] = await Promise.all([
    db.select({
      s:      staff,
      belong: { id: accounts.id, name: accounts.name },
    })
      .from(staff)
      .leftJoin(accounts, eq(staff.belong_account_id, accounts.id))
      .where(eq(staff.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:             assignment_staff.id,
      assignment_id:  assignment_staff.assignment_id,
      hours:          assignment_staff.service_hours,
      hourly_rate:    assignment_staff.hourly_rate,
      cost_per_hour:  assignment_staff.cost_per_hour,
      service_date:   assignments.service_date,
      assignment_no:  assignments.assignment_no,
      assignment_status: assignments.status,
      location:       assignments.service_location,
    })
      .from(assignment_staff)
      .innerJoin(assignments, eq(assignment_staff.assignment_id, assignments.id))
      .where(eq(assignment_staff.staff_id, id))
      .orderBy(desc(assignments.service_date)),
  ])

  if (!row) notFound()
  const s = row.s

  async function handleDelete() {
    'use server'
    await deleteStaff(id)
  }

  async function changeStatus(status: string) {
    'use server'
    await setStaffStatus(id, status)
  }

  const skills = Array.isArray(s.skills) ? s.skills as string[] : []
  const areas  = Array.isArray(s.available_areas) ? s.available_areas as string[] : []

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[
          { label: 'スタッフ', href: '/staff' },
          { label: s.name },
        ]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={s.name}
        meta={[
          ...(s.name_kana ? [{ value: s.name_kana }] : []),
          ...(row.belong?.id ? [{ label: '所属', value: <Link href={`/accounts/${row.belong.id}`} className="text-blue-600 hover:underline">{row.belong.name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/staff/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="このスタッフを削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      {/* ステータス（矢羽根） */}
      <div className="mb-6 max-w-md">
        <StageBar stages={STAFF_STAGES} currentStage={s.status} updateAction={changeStatus} />
      </div>

      {/* プロフィール */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">プロフィール</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-zinc-400 mb-1">性別</dt><dd>{s.gender ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">生年月日</dt><dd>{s.birth_date ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">電話</dt><dd>{s.phone ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">メール</dt><dd>{s.email ?? '—'}</dd></div>
        </dl>
      </section>

      {/* スキル + エリア */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">スキル・対応エリア</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-400 mb-2">スキル</p>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((sk) => <span key={sk} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{sk}</span>)}
              </div>
            ) : <p className="text-sm text-zinc-400">—</p>}
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-2">対応エリア</p>
            {areas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {areas.map((a) => <span key={a} className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded">{a}</span>)}
              </div>
            ) : <p className="text-sm text-zinc-400">—</p>}
          </div>
        </div>
      </section>

      {/* 標準単価 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">標準単価</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">請求時給 (顧客へ)</dt>
            <dd className="font-mono">{s.default_hourly_rate ? `¥${Number(s.default_hourly_rate).toLocaleString()}/h` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入時給 (人材会社へ)</dt>
            <dd className="font-mono">{s.default_cost_per_hour ? `¥${Number(s.default_cost_per_hour).toLocaleString()}/h` : '—'}</dd>
          </div>
        </dl>
      </section>

      {/* アサイン履歴 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">アサイン履歴 ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">アサインされた案件はまだありません</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {history.slice(0, 20).map((h) => (
              <li key={h.id} className="py-2 flex items-center gap-3">
                <span className="text-zinc-500 shrink-0">{h.service_date ?? '—'}</span>
                <Link href={`/assignments/${h.assignment_id}`} className="text-blue-600 hover:underline font-mono text-xs shrink-0">{h.assignment_no}</Link>
                <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded shrink-0 ${assignmentStatusColor(h.assignment_status)}`}>{h.assignment_status}</span>
                <span className="text-zinc-600 truncate">{h.location ?? '—'}</span>
                <span className="text-zinc-400 ml-auto shrink-0 font-mono text-xs">
                  {h.hours ? `${h.hours}h` : ''} {h.hourly_rate ? `¥${Number(h.hourly_rate).toLocaleString()}/h` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {s.notes && (
        <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-2">メモ</h2>
          <p className="text-sm text-zinc-800 whitespace-pre-wrap">{s.notes}</p>
        </section>
      )}
    </div>
  )
}
