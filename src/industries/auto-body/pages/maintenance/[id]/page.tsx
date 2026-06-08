import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  activities, tasks, expenses, change_logs, attachments,
} from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import { eq, and, desc, asc, inArray, count } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import ChangeLogSection from '@/components/ChangeLogSection'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import AttachmentsSection from '@/components/AttachmentsSection'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { deleteMaintenance } from '@/industries/auto-body/actions/maintenance'
import { toggleTaskDone } from '@/app/actions/tasks'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import MaintenanceFullView from '@/industries/auto-body/components/MaintenanceFullView'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [mRow, activitiesList, tasksList, expensesList, activityTypes, allUsers, changeLogCountRow, attachmentRows] = await Promise.all([
    db.select({
      m:       maintenance_records,
      vehicle: customer_vehicles,
      account: { id: accounts.id, name: accounts.name },
      contact: { id: contacts.id, full_name: contacts.full_name },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .where(eq(maintenance_records.id, id))
      .then((r) => r[0] ?? null),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('maintenance', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('maintenance', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('maintenance', id)))
      .orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    getAllUsers(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'maintenance'), eq(change_logs.object_id, id))),
    db.select().from(attachments).where(eq(attachments.maintenance_id, id)).orderBy(desc(attachments.created_at)),
  ])

  if (!mRow) notFound()
  const m = mRow.m
  const vehicle = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null

  // 表示用レコード名: {受付日YYYYMMDD}_{顧客}_{車種}
  const displayName = maintenanceDisplayName(m, account, contact, vehicle)

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'maintenance' && r.record_id === id)

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  async function handleDelete() {
    'use server'
    await deleteMaintenance(id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/maintenance/${id}`)
  }

  // 添付ファイル用 Server Actions (id を closure に閉じ込める)
  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('maintenance_id', id)
    formData.set('revalidate', `/maintenance/${id}`)
    await uploadAttachment(formData)
  }
  async function deleteFile(formData: FormData) {
    'use server'
    const attachId = formData.get('attach_id') as string
    const path     = formData.get('storage_path') as string
    await deleteAttachment(attachId, path, `/maintenance/${id}`)
  }

  // ── 活動・ToDo・経費タブ ───────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      <AuthGuard minRole="editor">
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/activities/new?maintenance_id=${id}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          <Link href={`/tasks/new?maintenance_id=${id}`}      className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          <Link href={`/expenses/new?maintenance_id=${id}`}   className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
        </div>
      </AuthGuard>
    </div>
  ) : (
    <>
      {activitiesList.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-zinc-800 mb-3">活動履歴 <span className="text-zinc-400 font-normal text-sm">({activitiesList.length})</span></h2>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {activitiesList.map((a) => (
              <div key={a.id} className="px-4 py-3 hover:bg-zinc-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-400">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}</span>
                </div>
                <Link href={`/activities/${a.id}`} className="text-sm font-medium text-zinc-800 hover:text-blue-600">{a.subject}</Link>
                {a.body && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{a.body}</p>}
                <OtherRelationsChips relations={(activityRelMap.get(a.id) ?? []).filter(isNotSelf)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {tasksList.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-zinc-800 mb-3">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {tasksList.map((t) => {
              const priority  = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue = !t.done && t.due_date && new Date(t.due_date) < new Date()
              return (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 ${t.done ? 'opacity-60' : ''}`}>
                  <AuthGuard minRole="editor">
                    <form action={toggleTask} className="shrink-0">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="done" value={(!t.done).toString()} />
                      <button type="submit" className={`w-5 h-5 rounded border-2 flex items-center justify-center ${t.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                        {t.done && <span className="text-xs leading-none">✓</span>}
                      </button>
                    </form>
                  </AuthGuard>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className={`text-sm ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>{t.title}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    {t.due_date && <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>📅 {new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}</p>}
                    <OtherRelationsChips relations={(taskRelMap.get(t.id) ?? []).filter(isNotSelf)} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {expensesList.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-zinc-800 mb-3">経費 <span className="text-zinc-400 font-normal text-sm">({expensesList.length})</span></h2>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expensesList.map((e) => (
              <div key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                <Link href={`/expenses/${e.id}`} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{e.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{e.category} · {e.expense_date}</p>
                  </div>
                  <span className="font-bold text-zinc-800 text-sm shrink-0">¥{Number(e.amount).toLocaleString()}</span>
                </Link>
                <OtherRelationsChips relations={(expenseRelMap.get(e.id) ?? []).filter(isNotSelf)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )

  // ── 履歴タブ ─────────────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType="maintenance" objectId={id} />
    </div>
  )

  // ── 全体ビュー（メインの編集 UI）─────────────────────────────
  const fullViewContent = (
    <MaintenanceFullView maintenanceId={id} users={allUsers} />
  )

  // ── 添付ファイルタブ ───────────────────────────────────────────
  const attachmentsContent = (
    <AttachmentsSection
      attachments={attachmentRows}
      supabaseUrl={SUPABASE_URL}
      uploadAction={uploadFile}
      deleteAction={deleteFile}
      heading="整備の添付ファイル"
    />
  )

  // ── メインタブ ──────────────────────────────────────────────────
  // 概要タブは廃止し、全体ビューを既定タブにする（編集はそのモーダル経由）。
  const tabsConfig: TabDef[] = [
    { id: 'full', label: '全体', content: fullViewContent },
  ]
  tabsConfig.push({
    id: 'interactions',
    label: '活動・ToDo・経費',
    badge: interactionCount > 0 ? interactionCount : undefined,
    content: interactionsContent,
  })
  tabsConfig.push({
    id: 'attachments',
    label: '添付ファイル',
    badge: attachmentRows.length > 0 ? attachmentRows.length : undefined,
    content: attachmentsContent,
  })
  if (changeLogCount > 0) {
    tabsConfig.push({ id: 'history', label: '履歴', badge: changeLogCount, content: historyContent })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <RecordHeader
        crumbs={[
          { label: '整備', href: '/maintenance' },
          { label: displayName },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/maintenance/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この整備を削除しますか？関連する行アイテム・諸費用・入金もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 break-all">{displayName}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          <span className="font-mono text-xs text-zinc-400">整備No: {m.maintenance_no}</span>
          {vehicle && (
            <>
              <span className="text-zinc-300">·</span>
              <Link href={`/customer-vehicles/${vehicle.id}`} className="hover:text-blue-600">
                🚗 {vehicle.plate_number ?? vehicle.car_model ?? '車両'}
              </Link>
            </>
          )}
          {account && (
            <>
              <span className="text-zinc-300">·</span>
              <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">🏢 {account.name}</Link>
            </>
          )}
        </div>
      </div>

      <RecordTabs defaultTab="full" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
