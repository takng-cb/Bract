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
import RecordHeader from '@/components/RecordHeader'
import { Package } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteAssignment, setAssignmentStatus, updateAssignmentBasic } from '@/industries/staffing/actions/assignments'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
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
  const editFlag = await canEdit()

  async function handleDelete() {
    'use server'
    await deleteAssignment(id)
  }

  async function saveAssignmentInline(formData: FormData) {
    'use server'
    await updateAssignmentBasic(id, formData)
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
      <RecordHeader
        crumbs={[
          { label: '案件', href: '/assignments' },
          { label: a.assignment_no },
        ]}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={a.title ?? a.assignment_no}
        meta={[
          ...(a.title ? [{ value: a.assignment_no, mono: true }] : []),
          ...(row.client?.id ? [{ label: '派遣先', value: <Link href={`/accounts/${row.client.id}`} className="text-blue-600 hover:underline">{row.client.name}</Link> }] : []),
          ...(row.contact?.id ? [{ label: '担当', value: <Link href={`/contacts/${row.contact.id}`} className="text-blue-600 hover:underline">{row.contact.full_name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2 shrink-0">
              <InlineEditButton event="bract:edit-assignment" />
              <Link href={`/assignments/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50 transition-colors">詳細</Link>
              <DeleteButton action={handleDelete} confirmMessage="この案件を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      {/* ステータス（矢羽根） */}
      <div className="mb-6">
        <StageBar stages={ASSIGNMENT_STAGES} currentStage={a.status} updateAction={changeStatus} />
      </div>

      {/* 業務情報（インライン編集） */}
      <EditableInfoCard
        title="業務情報"
        canEdit={editFlag}
        showEditButton={false}
        editEvent="bract:edit-assignment"
        action={saveAssignmentInline}
        fields={[
          { label: '業務日', name: 'service_date', kind: 'date', value: a.service_date ? String(a.service_date).slice(0, 10) : '', view: a.service_date ?? '—' },
          { label: '時間', view: a.service_start_time && a.service_end_time ? `${a.service_start_time} 〜 ${a.service_end_time}` : '—' },
          { label: '業務区分', name: 'service_type', kind: 'text', value: a.service_type, view: a.service_type ?? '—' },
          { label: '場所', name: 'service_location', kind: 'text', value: a.service_location, view: a.service_location ?? '—' },
          { label: '募集人数', name: 'staff_count_required', kind: 'number', value: a.staff_count_required != null ? String(a.staff_count_required) : '', view: `${a.staff_count_required ?? '—'} 名` },
          { label: '発注単価（請求総額）', name: 'client_total_fee', kind: 'number', value: a.client_total_fee != null ? String(a.client_total_fee) : '', view: a.client_total_fee ? `¥${Number(a.client_total_fee).toLocaleString()}` : '—' },
          { label: '業務内容', name: 'service_description', kind: 'textarea', value: a.service_description, fullWidth: true, view: a.service_description ? a.service_description : <span className="text-zinc-300">—</span> },
        ]}
      />

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
