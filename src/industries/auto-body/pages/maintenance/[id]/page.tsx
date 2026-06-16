import { buildRecordStream } from '@/lib/buildRecordStream'
import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  activities, tasks, expenses, change_logs, attachments,
} from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import RecordLinksSection from '@/components/RecordLinksSection'
import AuthGuard from '@/components/AuthGuard'
import { canEdit } from '@/lib/auth'
import MaintenanceDriveLinks from '@/industries/auto-body/components/MaintenanceDriveLinks'
import type { DriveLink } from '@/industries/auto-body/lib/driveEmbed'
import DeleteButton from '@/components/DeleteButton'
import AttachmentsSection from '@/components/AttachmentsSection'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { deleteMaintenance } from '@/industries/auto-body/actions/maintenance'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import MaintenanceFullView from '@/industries/auto-body/components/MaintenanceFullView'
import CaliInsuranceButton from '@/industries/auto-body/components/CaliInsuranceButton'
import { inferCaliClass } from '@/industries/auto-body/lib/caliInsurance'
import WeightTaxButton from '@/industries/auto-body/components/WeightTaxButton'
import { inferWtType } from '@/industries/auto-body/lib/weightTax'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'
import { getMaintenanceTotals } from '@/industries/auto-body/lib/maintenanceTotals'
import { NavIcon } from '@/lib/navIcon'
import { Wrench, CalendarClock, Receipt, Wallet, Activity, Paperclip, LayoutGrid } from 'lucide-react'
import { KpiBand, Badge, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const STATUS_TONE: Record<string, BadgeTone> = {
  '予約': 'neutral', '受付': 'info', '作業中': 'warn', '部品待ち': 'warn', '納車待ち': 'warn', '完了': 'pos', 'キャンセル': 'danger',
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [mRow, activitiesList, tasksList, expensesList, activityTypes, allUsers, changeLogs, attachmentRows] = await Promise.all([
    db.select({
      m: maintenance_records,
      vehicle: customer_vehicles,
      account: { id: accounts.id, name: accounts.name },
      contact: { id: contacts.id, full_name: contacts.full_name },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .where(eq(maintenance_records.id, id)).then((r) => r[0] ?? null),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('maintenance', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('maintenance', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('maintenance', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    getAllUsers(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'maintenance'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
    db.select().from(attachments).where(eq(attachments.maintenance_id, id)).orderBy(desc(attachments.created_at)),
  ])

  if (!mRow) notFound()
  const m = mRow.m
  const vehicle = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null
  const displayName = maintenanceDisplayName(m, account, contact, vehicle)
  const editable = await canEdit()

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  async function handleDelete() { 'use server'; await deleteMaintenance(id) }
  async function toggleTask(formData: FormData) { 'use server'; await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/maintenance/${id}`) }
  async function uploadFile(formData: FormData) { 'use server'; formData.set('maintenance_id', id); formData.set('revalidate', `/maintenance/${id}`); await uploadAttachment(formData) }
  async function deleteFile(formData: FormData) { 'use server'; await deleteAttachment(formData.get('attach_id') as string, formData.get('storage_path') as string, `/maintenance/${id}`) }

  // ── stream（活動 / ToDo / 経費 / 履歴）— 共通ヘルパで構築 ──
  const { stream, interactionCount } = buildRecordStream({
    activities: activitiesList, tasks: tasksList, expenses: expensesList, changeLogs,
    activityTypeLabels: ACTIVITY_TYPE_LABELS, toggleTask,
  })

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer relatedToken={`maintenance:${id}`} revalidate={`/maintenance/${id}`} activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))} userInitial={(displayName || '整').trim()[0]} createActivity={quickCreateActivity} createTask={quickCreateTask} createExpense={quickCreateExpense} />
    </AuthGuard>
  )

  const driveLinks = Array.isArray(m.drive_links) ? (m.drive_links as DriveLink[]) : []
  const fullViewContent = (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap justify-end gap-2">
        <WeightTaxButton maintenanceId={id} defaultType={inferWtType(vehicle?.vehicle_kind)} />
        <CaliInsuranceButton maintenanceId={id} defaultClass={inferCaliClass(vehicle?.vehicle_kind)} />
      </div>
      <MaintenanceDriveLinks maintenanceId={id} links={driveLinks} canEdit={editable} />
      <MaintenanceFullView maintenanceId={id} users={allUsers} />
    </div>
  )

  const attachmentsContent = (
    <div className="p-4">
      <AttachmentsSection attachments={attachmentRows} supabaseUrl={SUPABASE_URL} uploadAction={uploadFile} deleteAction={deleteFile} heading="整備の添付ファイル" />
    </div>
  )

  // 請求合計・残額のサマリー（REQ-0038：旧・全体ビューの合計カードから移設）
  const totals = await getMaintenanceTotals(id)
  const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

  const kpis: KpiItem[] = [
    { icon: <CalendarClock />, label: '入庫日', value: <span className="text-[17px]">{m.intake_date ?? '—'}</span>, sub: '受付' },
    { icon: <CalendarClock />, label: '納車日', value: <span className="text-[17px]">{m.delivery_date ?? '—'}</span>, sub: m.delivery_date ? '予定/実績' : '未定' },
    { icon: <Receipt />, label: '請求合計', value: yen(totals.grandTotal), sub: `税込 · 粗利 ${yen(totals.grossProfit)}` },
    {
      icon: <Wallet />, label: '残額',
      value: <span className={totals.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>{yen(totals.balance)}</span>,
      sub: `入金 ${yen(totals.paidSum)}`,
    },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '整備', href: '/maintenance' }, { label: displayName }]}
        avatar={<Wrench className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={displayName}
        badges={<Badge tone={STATUS_TONE[m.status] ?? 'neutral'} dot>{m.status}</Badge>}
        meta={[
          { label: '整備No', value: m.maintenance_no, mono: true },
          ...(vehicle?.id ? [{ icon: <NavIcon icon="🚗" className="w-3.5 h-3.5" />, value: <Link href={`/customer-vehicles/${vehicle.id}`} className="text-brand-700 hover:underline">{vehicle.plate_number ?? vehicle.car_model ?? '車両'}</Link> }] : []),
          ...(account ? [{ icon: <NavIcon icon="🏢" className="w-3.5 h-3.5" />, value: <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{account.name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <DeleteButton action={handleDelete} confirmMessage="この整備を削除しますか？関連する行アイテム・諸費用・入金もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      <KpiBand items={kpis} />

      <RecordTabPanel
        tabs={[
          { id: 'full', label: '全体', icon: <LayoutGrid />, content: fullViewContent },
          { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
          { id: 'files', label: '添付', icon: <Paperclip />, count: attachmentRows.length, content: attachmentsContent },
        ]}
      />

      <div className="mt-4"><RecordLinksSection selfApi="maintenance" selfId={id} /></div>

      <div className="mt-4 text-right"><RecordId id={id} /></div>
    </div>
  )
}
