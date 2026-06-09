/**
 * /assignments/[id] — 案件詳細（Phase 2：調達・調整 / REQ-0005 spec §3-4）
 *
 * 案件情報 ＋ 打診状況(outreach) ＋ 候補集約・比較(assignment_staff) ＋ 固定単価モデルの粗利。
 * 業務フロー：受付 → 打診中 → 候補集約 → 確定 → 実施 → 完了。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts, contacts, staff, outreach } from '@/lib/schema'
import { eq, or, ne, asc } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteAssignment, setAssignmentStatus } from '@/industries/staffing/actions/assignments'
import StageBar from '@/components/StageBar'
import { ASSIGNMENT_STAGES } from '@/lib/statusStages'
import OutreachSection from '@/industries/staffing/components/OutreachSection'
import CandidatesSection from '@/industries/staffing/components/CandidatesSection'

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params

  const agencyAcc = accounts
  const [row, candidateRows, outreachRows, suppliers, staffList] = await Promise.all([
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
      id:               assignment_staff.id,
      staff_id:         assignment_staff.staff_id,
      staff_name:       staff.name,
      talent_name:      assignment_staff.talent_name,
      agency_account_id: assignment_staff.agency_account_id,
      agency_name:      agencyAcc.name,
      proposed_rate:    assignment_staff.proposed_rate,
      candidate_status: assignment_staff.candidate_status,
      notes:            assignment_staff.notes,
    })
      .from(assignment_staff)
      .leftJoin(staff, eq(assignment_staff.staff_id, staff.id))
      .leftJoin(agencyAcc, eq(assignment_staff.agency_account_id, agencyAcc.id))
      .where(eq(assignment_staff.assignment_id, id)),
    db.select({
      id:                outreach.id,
      agency_account_id: outreach.agency_account_id,
      agency_name:       accounts.name,
      status:            outreach.status,
      sent_at:           outreach.sent_at,
      notes:             outreach.notes,
    })
      .from(outreach)
      .leftJoin(accounts, eq(outreach.agency_account_id, accounts.id))
      .where(eq(outreach.assignment_id, id))
      .orderBy(asc(outreach.created_at)),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(or(eq(accounts.account_role, 'supplier'), eq(accounts.account_role, 'both')))
      .orderBy(asc(accounts.name)),
    db.select({ id: staff.id, name: staff.name, default_fixed_rate: staff.default_fixed_rate })
      .from(staff)
      .where(ne(staff.status, '引退'))
      .orderBy(asc(staff.name)),
  ])

  if (!row) notFound()
  const a = row.a

  async function handleDelete() {
    'use server'
    await deleteAssignment(id)
  }

  async function changeStatus(status: string) {
    'use server'
    await setAssignmentStatus(id, status)
  }

  const candidates = candidateRows
  const outreachItems = outreachRows.map((o) => ({
    id: o.id,
    agency_account_id: o.agency_account_id,
    agency_name: o.agency_name,
    status: o.status,
    sent_at: o.sent_at ? o.sent_at.toISOString() : null,
    notes: o.notes,
  }))

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Breadcrumbs items={[
        { label: '案件', href: '/assignments' },
        { label: a.assignment_no },
      ]} />

      <div className="flex items-start justify-between gap-3 mt-2 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">{a.title ?? a.assignment_no}</h1>
          {a.title && <p className="text-xs text-zinc-400 font-mono mb-1">{a.assignment_no}</p>}
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
            <Link href={`/assignments/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">編集</Link>
            <DeleteButton action={handleDelete} confirmMessage="この案件を削除しますか？" />
          </div>
        </AuthGuard>
      </div>

      {/* ステータス（矢羽根） */}
      <div className="mb-6">
        <StageBar stages={ASSIGNMENT_STAGES} currentStage={a.status} updateAction={changeStatus} />
      </div>

      {/* 業務情報 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">業務情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-zinc-400 mb-1">業務日</dt><dd>{a.service_date ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">時間</dt><dd>{a.service_start_time && a.service_end_time ? `${a.service_start_time} 〜 ${a.service_end_time}` : '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">業務区分</dt><dd>{a.service_type ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">場所</dt><dd>{a.service_location ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">募集人数</dt><dd>{a.staff_count_required ?? '—'} 名</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">発注単価（請求総額）</dt><dd className="font-mono">{a.client_total_fee ? `¥${Number(a.client_total_fee).toLocaleString()}` : '—'}</dd></div>
          {a.service_description && (
            <div className="sm:col-span-2"><dt className="text-xs text-zinc-400 mb-1">業務内容</dt><dd className="whitespace-pre-wrap">{a.service_description}</dd></div>
          )}
        </dl>
      </section>

      {/* 打診状況 */}
      <OutreachSection assignmentId={id} agencies={suppliers} items={outreachItems} />

      {/* 候補集約・比較 ＋ 固定単価モデルの粗利 */}
      <CandidatesSection
        assignmentId={id}
        agencies={suppliers}
        staffList={staffList}
        items={candidates}
        clientTotalFee={a.client_total_fee}
        requiredCount={a.staff_count_required}
      />

      {a.internal_memo && (
        <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-2">内部メモ</h2>
          <p className="text-sm text-zinc-800 whitespace-pre-wrap">{a.internal_memo}</p>
        </section>
      )}

      {a.raw_message && (
        <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mt-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-2">依頼原文（クイック登録）</h2>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{a.raw_message}</p>
        </section>
      )}
    </div>
  )
}
