/**
 * /staff/[id] — スタッフ詳細（新2カラムレイアウト / #design）
 */
import { notFound } from 'next/navigation'
import { UserRound, Briefcase, Wallet, Activity } from 'lucide-react'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { staff, accounts, assignment_staff, assignments, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, desc, asc, and, inArray } from 'drizzle-orm'
import { getAllUsers } from '@/lib/userUtils'
import { getActivityTypes } from '@/lib/activityTypes'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteStaff, setStaffStatus, updateStaffBasic } from '@/industries/staffing/actions/staff'
import { assignmentStatusColor } from '@/industries/staffing/lib/staffingService'
import { canEdit } from '@/lib/auth'
import EditableInfoCard, { type EditField } from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import StageBar from '@/components/StageBar'
import { STAFF_STAGES } from '@/lib/statusStages'
import { RecordColumns, KpiBand, RecordTable, RecordTableEmpty, Badge, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream, { type StreamEvent } from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'
import { requireBookRead } from '@/lib/permissions'

const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('staff')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params

  const [row, history, accountsList, usersList] = await Promise.all([
    db.select({ s: staff, belong: { id: accounts.id, name: accounts.name } }).from(staff).leftJoin(accounts, eq(staff.belong_account_id, accounts.id)).where(eq(staff.id, id)).then((r) => r[0] ?? null),
    db.select({ id: assignment_staff.id, assignment_id: assignment_staff.assignment_id, hours: assignment_staff.service_hours, hourly_rate: assignment_staff.hourly_rate, cost_per_hour: assignment_staff.cost_per_hour, service_date: assignments.service_date, assignment_no: assignments.assignment_no, assignment_status: assignments.status, location: assignments.service_location })
      .from(assignment_staff).innerJoin(assignments, eq(assignment_staff.assignment_id, assignments.id)).where(eq(assignment_staff.staff_id, id)).orderBy(desc(assignments.service_date)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])

  const [activitiesList, tasksList, expensesList, activityTypes, changeLogs] = await Promise.all([
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('staff', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('staff', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('staff', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'staff'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
  ])

  if (!row) notFound()
  const s = row.s
  const editFlag = await canEdit()

  async function handleDelete() { 'use server'; await deleteStaff(id) }
  async function saveStaffInline(formData: FormData) { 'use server'; await updateStaffBasic(id, formData) }
  async function changeStatus(status: string) { 'use server'; await setStaffStatus(id, status) }
  async function toggleTask(formData: FormData) { 'use server'; await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/staff/${id}`) }

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
      <InlineComposer relatedToken={`staff:${id}`} revalidate={`/staff/${id}`} activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))} createActivity={quickCreateActivity} createTask={quickCreateTask} createExpense={quickCreateExpense} />
    </AuthGuard>
  )

  const skills = Array.isArray(s.skills) ? s.skills as string[] : []
  const areas = Array.isArray(s.available_areas) ? s.available_areas as string[] : []
  const accountOptions = accountsList.map((a) => ({ value: a.id, label: a.name }))
  const userOptions = usersList.map((u) => ({ value: u.id, label: u.name }))
  const ownerName = s.owner_id ? (usersList.find((u) => u.id === s.owner_id)?.name ?? null) : null

  const staffFields: EditField[] = [
    { section: '基本', label: '氏名', name: 'name', kind: 'text', value: s.name, view: s.name ?? '—' },
    { section: '基本', label: 'フリガナ', name: 'name_kana', kind: 'text', value: s.name_kana, view: s.name_kana ?? '—' },
    { section: '基本', label: '所属', name: 'belong_account_id', kind: 'select', value: s.belong_account_id ?? '', options: accountOptions, view: row.belong?.id ? <Link href={`/accounts/${row.belong.id}`} className="text-brand-700 hover:underline">{row.belong.name}</Link> : '—' },
    { section: '基本', label: '担当', name: 'owner_id', kind: 'select', value: s.owner_id ?? '', options: userOptions, view: ownerName ?? '—' },
    { section: 'プロフィール', label: '性別', name: 'gender', kind: 'text', value: s.gender, view: s.gender ?? '—' },
    { section: 'プロフィール', label: '生年月日', name: 'birth_date', kind: 'date', value: s.birth_date ? String(s.birth_date).slice(0, 10) : '', view: s.birth_date ?? '—' },
    { section: 'プロフィール', label: '電話', name: 'phone', kind: 'tel', value: s.phone, view: s.phone ?? '—' },
    { section: 'プロフィール', label: 'メール', name: 'email', kind: 'email', value: s.email, view: s.email ?? '—' },
    { section: 'スキル・対応エリア', label: 'スキル（カンマ区切り）', name: 'skills', kind: 'text', value: skills.join(', '), fullWidth: true, view: skills.length > 0 ? <div className="flex flex-wrap gap-1.5">{skills.map((sk) => <span key={sk} className="text-xs px-2 py-0.5 bg-sky-50 text-sky-700 rounded">{sk}</span>)}</div> : <span className="text-zinc-300">—</span> },
    { section: 'スキル・対応エリア', label: '対応エリア（カンマ区切り）', name: 'available_areas', kind: 'text', value: areas.join(', '), fullWidth: true, view: areas.length > 0 ? <div className="flex flex-wrap gap-1.5">{areas.map((a) => <span key={a} className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded">{a}</span>)}</div> : <span className="text-zinc-300">—</span> },
    { section: '標準単価', label: '請求時給 (顧客へ)', name: 'default_hourly_rate', kind: 'number', value: s.default_hourly_rate != null ? String(s.default_hourly_rate) : '', view: s.default_hourly_rate ? `¥${Number(s.default_hourly_rate).toLocaleString()}/h` : '—' },
    { section: '標準単価', label: '仕入時給 (人材会社へ)', name: 'default_cost_per_hour', kind: 'number', value: s.default_cost_per_hour != null ? String(s.default_cost_per_hour) : '', view: s.default_cost_per_hour ? `¥${Number(s.default_cost_per_hour).toLocaleString()}/h` : '—' },
    { section: 'メモ', label: 'メモ', name: 'notes', kind: 'textarea', value: s.notes, fullWidth: true, view: s.notes ? s.notes : <span className="text-zinc-300">—</span> },
  ]

  const kpis: KpiItem[] = [
    { icon: <Briefcase />, label: 'アサイン', value: <>{history.length}<small> 件</small></>, sub: history[0]?.service_date ? `最新 ${history[0].service_date}` : '—' },
    { icon: <Wallet />, label: '請求時給', value: s.default_hourly_rate ? `¥${Number(s.default_hourly_rate).toLocaleString()}` : '—', sub: '顧客へ' },
    { icon: <Wallet />, label: '仕入時給', value: s.default_cost_per_hour ? `¥${Number(s.default_cost_per_hour).toLocaleString()}` : '—', sub: '人材会社へ' },
  ]

  const historyTab = history.length === 0 ? <RecordTableEmpty>アサインされた案件はまだありません</RecordTableEmpty> : (
    <RecordTable columns={[{ label: '業務日' }, { label: '案件No' }, { label: '状態' }, { label: '場所' }, { label: '実績', num: true }]}>
      {history.slice(0, 30).map((h) => (
        <tr key={h.id} className="hover:bg-zinc-50">
          <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600">{h.service_date ?? '—'}</td>
          <td className="px-4 py-2.5 border-b border-zinc-100"><Link href={`/assignments/${h.assignment_id}`} className="text-brand-700 hover:underline font-mono text-xs">{h.assignment_no}</Link></td>
          <td className="px-4 py-2.5 border-b border-zinc-100"><span className={`inline-block px-1.5 py-0.5 text-[10px] rounded ${assignmentStatusColor(h.assignment_status)}`}>{h.assignment_status}</span></td>
          <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600 truncate max-w-40">{h.location ?? '—'}</td>
          <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-500 font-mono text-xs">{h.hours ? `${h.hours}h` : ''} {h.hourly_rate ? `¥${Number(h.hourly_rate).toLocaleString()}/h` : ''}</td>
        </tr>
      ))}
    </RecordTable>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: 'スタッフ', href: '/staff' }, { label: s.name }]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={s.name}
        meta={[
          ...(s.name_kana ? [{ value: s.name_kana }] : []),
          ...(row.belong?.id ? [{ label: '所属', value: <Link href={`/accounts/${row.belong.id}`} className="text-brand-700 hover:underline">{row.belong.name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2 shrink-0">
              <InlineEditButton event="bract:edit-staff" />
              <DeleteButton action={handleDelete} confirmMessage="このスタッフを削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5 max-w-md">
        <StageBar stages={STAFF_STAGES} currentStage={s.status} updateAction={changeStatus} />
      </div>

      <KpiBand items={kpis} />

      <RecordColumns
        left={<EditableInfoCard title="スタッフ情報（全項目）" dense canEdit={editFlag} editEvent="bract:edit-staff" action={saveStaffInline} fields={staffFields} />}
      >
        <RecordTabPanel tabs={[
          { id: 'assign', label: 'アサイン履歴', icon: <Briefcase />, count: history.length, content: historyTab },
          { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
        ]} />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
