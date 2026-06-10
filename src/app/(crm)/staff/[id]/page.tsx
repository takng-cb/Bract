/**
 * /staff/[id] — スタッフ詳細（新2カラムレイアウト / #design）
 */
import { notFound } from 'next/navigation'
import { UserRound, Briefcase, Wallet } from 'lucide-react'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { staff, accounts, assignment_staff, assignments } from '@/lib/schema'
import { eq, desc, asc } from 'drizzle-orm'
import { getAllUsers } from '@/lib/userUtils'
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
import { RecordColumns, KpiBand, RecordTable, RecordTableEmpty, type KpiItem } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const { id } = await params

  const [row, history, accountsList, usersList] = await Promise.all([
    db.select({ s: staff, belong: { id: accounts.id, name: accounts.name } }).from(staff).leftJoin(accounts, eq(staff.belong_account_id, accounts.id)).where(eq(staff.id, id)).then((r) => r[0] ?? null),
    db.select({ id: assignment_staff.id, assignment_id: assignment_staff.assignment_id, hours: assignment_staff.service_hours, hourly_rate: assignment_staff.hourly_rate, cost_per_hour: assignment_staff.cost_per_hour, service_date: assignments.service_date, assignment_no: assignments.assignment_no, assignment_status: assignments.status, location: assignments.service_location })
      .from(assignment_staff).innerJoin(assignments, eq(assignment_staff.assignment_id, assignments.id)).where(eq(assignment_staff.staff_id, id)).orderBy(desc(assignments.service_date)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])

  if (!row) notFound()
  const s = row.s
  const editFlag = await canEdit()

  async function handleDelete() { 'use server'; await deleteStaff(id) }
  async function saveStaffInline(formData: FormData) { 'use server'; await updateStaffBasic(id, formData) }
  async function changeStatus(status: string) { 'use server'; await setStaffStatus(id, status) }

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
        left={<EditableInfoCard title="スタッフ情報（全項目）" dense canEdit={editFlag} showEditButton={false} editEvent="bract:edit-staff" action={saveStaffInline} fields={staffFields} />}
      >
        <RecordTabPanel tabs={[{ id: 'assign', label: 'アサイン履歴', icon: <Briefcase />, count: history.length, content: historyTab }]} />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
