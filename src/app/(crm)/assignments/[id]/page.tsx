/**
 * /assignments/[id] — 案件詳細（新2カラムレイアウト / #design）
 * 案件情報 ＋ 打診状況(outreach) ＋ 候補集約・比較(assignment_staff)。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts, contacts, staff, outreach, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, or, ne, asc, desc, and, inArray } from 'drizzle-orm'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import { Package, Users, Wallet, UserCheck, Send, FileText, Activity } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteAssignment, setAssignmentStatus, updateAssignmentBasic } from '@/industries/staffing/actions/assignments'
import { canEdit } from '@/lib/auth'
import EditableInfoCard, { type EditField } from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { getAllUsers } from '@/lib/userUtils'
import { getActivityTypes } from '@/lib/activityTypes'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import StageBar from '@/components/StageBar'
import { ASSIGNMENT_STAGES } from '@/lib/statusStages'
import OutreachSection from '@/industries/staffing/components/OutreachSection'
import CandidatesSection from '@/industries/staffing/components/CandidatesSection'
import { RecordColumns, KpiBand, Badge, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream, { type StreamEvent } from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'

const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params

  const agencyAcc = accounts
  const [row, candidateRows, outreachRows, suppliers, staffList, accountsList, contactsList, usersList] = await Promise.all([
    db.select({ a: assignments, client: { id: accounts.id, name: accounts.name }, contact: { id: contacts.id, full_name: contacts.full_name } })
      .from(assignments).leftJoin(accounts, eq(assignments.client_account_id, accounts.id)).leftJoin(contacts, eq(assignments.client_contact_id, contacts.id)).where(eq(assignments.id, id)).then((r) => r[0] ?? null),
    db.select({ id: assignment_staff.id, staff_id: assignment_staff.staff_id, staff_name: staff.name, talent_name: assignment_staff.talent_name, agency_account_id: assignment_staff.agency_account_id, agency_name: agencyAcc.name, proposed_rate: assignment_staff.proposed_rate, candidate_status: assignment_staff.candidate_status, notes: assignment_staff.notes })
      .from(assignment_staff).leftJoin(staff, eq(assignment_staff.staff_id, staff.id)).leftJoin(agencyAcc, eq(assignment_staff.agency_account_id, agencyAcc.id)).where(eq(assignment_staff.assignment_id, id)),
    db.select({ id: outreach.id, agency_account_id: outreach.agency_account_id, agency_name: accounts.name, status: outreach.status, sent_at: outreach.sent_at, notes: outreach.notes })
      .from(outreach).leftJoin(accounts, eq(outreach.agency_account_id, accounts.id)).where(eq(outreach.assignment_id, id)).orderBy(asc(outreach.created_at)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(or(eq(accounts.account_role, 'supplier'), eq(accounts.account_role, 'both'))).orderBy(asc(accounts.name)),
    db.select({ id: staff.id, name: staff.name, default_fixed_rate: staff.default_fixed_rate }).from(staff).where(ne(staff.status, '引退')).orderBy(asc(staff.name)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name }).from(contacts).orderBy(asc(contacts.full_name)),
    getAllUsers(),
  ])

  const [activitiesList, tasksList, expensesList, activityTypes, changeLogs] = await Promise.all([
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('assignment', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('assignment', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('assignment', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'assignment'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
  ])

  if (!row) notFound()
  const a = row.a
  const editFlag = await canEdit()

  async function handleDelete() { 'use server'; await deleteAssignment(id) }
  async function saveAssignmentInline(formData: FormData) { 'use server'; await updateAssignmentBasic(id, formData) }
  async function changeStatus(status: string) { 'use server'; await setAssignmentStatus(id, status) }
  async function toggleTask(formData: FormData) { 'use server'; await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/assignments/${id}`) }

  // ── アクティビティ・ストリーム（活動 / ToDo / 経費 / 履歴）──
  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label
  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()
  const dayLabel = (d: Date) => {
    const t0 = new Date(NOW); t0.setHours(0, 0, 0, 0); const d0 = new Date(d); d0.setHours(0, 0, 0, 0)
    const diff = Math.round((t0.getTime() - d0.getTime()) / 86400000)
    if (diff === 0) return '今日'; if (diff === 1) return '昨日'
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
  }
  const hm = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const stream: (StreamEvent & { sort: number })[] = []
  for (const act of activitiesList) {
    const d = act.occurred_at ? new Date(act.occurred_at) : act.created_at ? new Date(act.created_at) : null
    if (!d) continue
    stream.push({ id: `a-${act.id}`, kind: 'act', typeLabel: ACTIVITY_TYPE_LABELS[act.type] ?? act.type, time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <><Link href={`/activities/${act.id}`} className="font-semibold text-zinc-900 hover:text-brand-700">{act.subject}</Link>{act.body && <span className="block text-zinc-500 text-[12.5px] mt-0.5 line-clamp-2">{act.body}</span>}</> })
  }
  for (const t of tasksList) {
    const d = t.created_at ? new Date(t.created_at) : null
    if (!d) continue
    const pr = PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.medium
    stream.push({ id: `t-${t.id}`, kind: 'todo', typeLabel: 'ToDo', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      leading: <AuthGuard minRole="editor"><form action={toggleTask}><input type="hidden" name="task_id" value={t.id} /><input type="hidden" name="done" value={(!t.done).toString()} /><button type="submit" className={`w-4.5 h-4.5 rounded-md border-[1.5px] grid place-items-center ${t.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-zinc-300 hover:border-brand-400'}`}>{t.done && <span className="text-[10px] leading-none">✓</span>}</button></form></AuthGuard>,
      body: <div className="flex items-center gap-2 flex-wrap"><Link href={`/tasks/${t.id}`} className={`font-semibold hover:text-brand-700 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{t.title}</Link><Badge tone={pr.tone}>{pr.label}</Badge></div> })
  }
  for (const e of expensesList) {
    const d = e.expense_date ? new Date(e.expense_date) : e.created_at ? new Date(e.created_at) : null
    if (!d) continue
    stream.push({ id: `e-${e.id}`, kind: 'exp', typeLabel: '経費', day: dayLabel(d), sort: d.getTime(),
      body: <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-2"><span className="font-semibold text-zinc-900">{e.title}</span><span className="font-bold text-zinc-900 shrink-0">¥{Number(e.amount).toLocaleString()}</span></Link> })
  }
  for (const c of changeLogs) {
    const d = c.changed_at ? new Date(c.changed_at) : null
    if (!d) continue
    stream.push({ id: `c-${c.id}`, kind: 'his', typeLabel: '履歴', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <span className="text-zinc-600">{c.field_label}を <span className="text-zinc-900 font-medium">{c.old_value ?? '—'}</span> → <span className="text-zinc-900 font-medium">{c.new_value ?? '—'}</span> に変更</span> })
  }
  stream.sort((x, y) => y.sort - x.sort)
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer relatedToken={`assignment:${id}`} revalidate={`/assignments/${id}`} activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))} createActivity={quickCreateActivity} createTask={quickCreateTask} createExpense={quickCreateExpense} />
    </AuthGuard>
  )

  const accountOptions = accountsList.map((acc) => ({ value: acc.id, label: acc.name }))
  const contactOptions = contactsList.map((c) => ({ value: c.id, label: c.full_name }))
  const userOptions = usersList.map((u) => ({ value: u.id, label: u.name }))
  const ownerName = a.owner_id ? (usersList.find((u) => u.id === a.owner_id)?.name ?? null) : null

  const assignmentFields: EditField[] = [
    { section: '案件', label: '派遣先', name: 'client_account_id', kind: 'select', value: a.client_account_id ?? '', options: accountOptions, view: row.client?.id ? <Link href={`/accounts/${row.client.id}`} className="text-brand-700 hover:underline">{row.client.name}</Link> : '—' },
    { section: '案件', label: '担当者', name: 'client_contact_id', kind: 'select', value: a.client_contact_id ?? '', options: contactOptions, view: row.contact?.id ? <Link href={`/contacts/${row.contact.id}`} className="text-brand-700 hover:underline">{row.contact.full_name}</Link> : '—' },
    { section: '案件', label: '社内担当', name: 'owner_id', kind: 'select', value: a.owner_id ?? '', options: userOptions, view: ownerName ?? '—' },
    { section: '業務', label: '業務日', name: 'service_date', kind: 'date', value: a.service_date ? String(a.service_date).slice(0, 10) : '', view: a.service_date ?? '—' },
    { section: '業務', label: '開始時刻', name: 'service_start_time', kind: 'text', value: a.service_start_time, view: a.service_start_time ?? '—' },
    { section: '業務', label: '終了時刻', name: 'service_end_time', kind: 'text', value: a.service_end_time, view: a.service_end_time ?? '—' },
    { section: '業務', label: '業務区分', name: 'service_type', kind: 'text', value: a.service_type, view: a.service_type ?? '—' },
    { section: '業務', label: '場所', name: 'service_location', kind: 'text', value: a.service_location, view: a.service_location ?? '—' },
    { section: '業務', label: '募集人数', name: 'staff_count_required', kind: 'number', value: a.staff_count_required != null ? String(a.staff_count_required) : '', view: `${a.staff_count_required ?? '—'} 名` },
    { section: '業務', label: '発注単価（請求総額）', name: 'client_total_fee', kind: 'number', value: a.client_total_fee != null ? String(a.client_total_fee) : '', view: a.client_total_fee ? `¥${Number(a.client_total_fee).toLocaleString()}` : '—' },
    { section: '業務', label: '業務内容', name: 'service_description', kind: 'textarea', value: a.service_description, fullWidth: true, view: a.service_description ? a.service_description : <span className="text-zinc-300">—</span> },
    { section: '内部メモ', label: '内部メモ', name: 'internal_memo', kind: 'textarea', value: a.internal_memo, fullWidth: true, view: a.internal_memo ? a.internal_memo : <span className="text-zinc-300">—</span> },
  ]

  const outreachItems = outreachRows.map((o) => ({ id: o.id, agency_account_id: o.agency_account_id, agency_name: o.agency_name, status: o.status, sent_at: o.sent_at ? o.sent_at.toISOString() : null, notes: o.notes }))

  const kpis: KpiItem[] = [
    { icon: <Users />, label: '募集人数', value: <>{a.staff_count_required ?? '—'}<small> 名</small></>, sub: a.service_date ?? '—' },
    { icon: <Wallet />, label: '発注単価', value: a.client_total_fee ? `¥${Number(a.client_total_fee).toLocaleString()}` : '—', sub: '請求総額' },
    { icon: <UserCheck />, label: '候補', value: <>{candidateRows.length}<small> 名</small></>, sub: '集約' },
    { icon: <Send />, label: '打診', value: <>{outreachItems.length}<small> 件</small></>, sub: '送信済' },
  ]

  const coordinationTab = (
    <div className="px-4 py-4 space-y-4">
      <OutreachSection assignmentId={id} agencies={suppliers} items={outreachItems} />
      <CandidatesSection assignmentId={id} agencies={suppliers} staffList={staffList} items={candidateRows} clientTotalFee={a.client_total_fee} requiredCount={a.staff_count_required} />
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '案件', href: '/assignments' }, { label: a.assignment_no }]}
        avatar={<Package className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={a.title ?? a.assignment_no}
        meta={[
          ...(a.title ? [{ value: a.assignment_no, mono: true }] : []),
          ...(row.client?.id ? [{ label: '派遣先', value: <Link href={`/accounts/${row.client.id}`} className="text-brand-700 hover:underline">{row.client.name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2 shrink-0">
              <InlineEditButton event="bract:edit-assignment" />
              <DeleteButton action={handleDelete} confirmMessage="この案件を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5">
        <StageBar stages={ASSIGNMENT_STAGES} currentStage={a.status} updateAction={changeStatus} />
      </div>

      <KpiBand items={kpis} />

      <RecordColumns
        left={<EditableInfoCard title="案件情報（全項目）" dense canEdit={editFlag} editEvent="bract:edit-assignment" action={saveAssignmentInline} fields={assignmentFields} />}
      >
        <RecordTabPanel
          tabs={[
            { id: 'coord', label: '打診・候補', icon: <UserCheck />, count: candidateRows.length, content: coordinationTab },
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            ...(a.raw_message ? [{ id: 'raw', label: '依頼原文', icon: <FileText />, content: <div className="px-4 py-4"><p className="text-sm text-zinc-600 whitespace-pre-wrap">{a.raw_message}</p></div> }] : []),
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
