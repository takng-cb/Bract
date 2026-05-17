import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  activities, tasks, expenses, change_logs,
  maintenance_line_items, maintenance_fees,
} from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import { eq, and, desc, asc, inArray, count, sql } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import ChangeLogSection from '@/components/ChangeLogSection'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { deleteMaintenance, updateMaintenanceStatus } from '@/industries/auto-body/actions/maintenance'
import { toggleTaskDone } from '@/app/actions/tasks'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import MaintenanceLineItemsEditor from '@/industries/auto-body/components/MaintenanceLineItemsEditor'
import MaintenanceFeesEditor from '@/industries/auto-body/components/MaintenanceFeesEditor'
import MaintenancePaymentsEditor from '@/industries/auto-body/components/MaintenancePaymentsEditor'
import MaintenanceFullView from '@/industries/auto-body/components/MaintenanceFullView'

const STATUS_STAGES: StageConfig[] = [
  { value: '予約',     label: '予約',     activeColor: '#71717a', pastColor: '#d4d4d8' },
  { value: '受付',     label: '受付',     activeColor: '#2563eb', pastColor: '#93c5fd' },
  { value: '作業中',   label: '作業中',   activeColor: '#d97706', pastColor: '#fcd34d' },
  { value: '納車待ち', label: '納車待ち', activeColor: '#ea580c', pastColor: '#fdba74' },
  { value: '完了',     label: '完了 ✓',   activeColor: '#16a34a', pastColor: '#86efac' },
]

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

// 行アイテム以外のサブタブ用プレースホルダ（次フェーズ実装予定）
function Placeholder({ title }: { title: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
      <p className="text-sm text-zinc-500">{title} は次のフェーズで実装予定です</p>
    </div>
  )
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [mRow, activitiesList, tasksList, expensesList, activityTypes, allUsers, changeLogCountRow, editable, lineTotalsRow, feeTotalsRow] = await Promise.all([
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
    canEdit(),
    // 集計（請求合計の参考表示用）
    db.select({
      labor: sql<string>`COALESCE(SUM(CASE WHEN ${maintenance_line_items.is_excluded} THEN 0 ELSE COALESCE(${maintenance_line_items.labor_amount}, 0) END), 0)`,
      parts: sql<string>`COALESCE(SUM(CASE WHEN ${maintenance_line_items.is_excluded} THEN 0 ELSE COALESCE(${maintenance_line_items.parts_qty}, 0) * COALESCE(${maintenance_line_items.parts_unit_price}, 0) END), 0)`,
    }).from(maintenance_line_items).where(eq(maintenance_line_items.maintenance_id, id)),
    db.select({
      fees: sql<string>`COALESCE(SUM(COALESCE(${maintenance_fees.amount}, 0)), 0)`,
    }).from(maintenance_fees).where(eq(maintenance_fees.maintenance_id, id)),
  ])

  if (!mRow) notFound()
  const m = mRow.m
  const vehicle = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'maintenance' && r.record_id === id)

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  const receptionUser = m.reception_owner_id ? allUsers.find((u) => u.id === m.reception_owner_id) : null
  const workerUser    = m.worker_owner_id    ? allUsers.find((u) => u.id === m.worker_owner_id)    : null

  async function handleDelete() {
    'use server'
    await deleteMaintenance(id)
  }

  async function changeStatus(status: string) {
    'use server'
    await updateMaintenanceStatus(id, status)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/maintenance/${id}`)
  }

  // ── 概要タブ内のサブタブ ───────────────────────────────────────

  // 1. 基本情報
  const basicInfoContent = (
    <>
      <div className="mb-6">
        <StageBar stages={STATUS_STAGES} currentStage={m.status} updateAction={changeStatus} />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">概要</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><dt className="text-xs text-zinc-400 mb-1">整備No</dt><dd className="text-sm font-mono text-zinc-800">{m.maintenance_no}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">入庫日時</dt><dd className="text-sm text-zinc-800">{m.intake_date ?? '—'} {m.intake_time}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">納車日時</dt><dd className="text-sm text-zinc-800">{m.delivery_date ?? '—'} {m.delivery_time}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">引取場所</dt><dd className="text-sm text-zinc-800">{m.pickup_location ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">引渡場所</dt><dd className="text-sm text-zinc-800">{m.delivery_location ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">売上計上日</dt><dd className="text-sm text-zinc-800">{m.sales_recording_date ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">総走行距離</dt><dd className="text-sm text-zinc-800">{m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">拠点</dt><dd className="text-sm text-zinc-800">{m.branch_id ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">入庫区分</dt><dd className="text-sm text-zinc-800">{m.intake_category ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">受付担当者</dt><dd className="text-sm text-zinc-800">{receptionUser?.name ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">作業担当者</dt><dd className="text-sm text-zinc-800">{workerUser?.name ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">登録日</dt><dd className="text-sm text-zinc-800">{m.created_at ? new Date(m.created_at).toLocaleDateString('ja-JP') : '—'}</dd></div>
        </dl>
      </div>

      {/* 顧客・車両 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">顧客・車両</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">顧客（取引先）</dt>
            <dd className="text-sm">{account ? <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">🏢 {account.name}</Link> : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">顧客担当者</dt>
            <dd className="text-sm">{contact ? <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">👤 {contact.full_name}</Link> : '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-400 mb-1">車両</dt>
            <dd className="text-sm">
              {vehicle ? (
                <Link href={`/customer-vehicles/${vehicle.id}`} className="text-blue-600 hover:underline">
                  🚗 {vehicle.plate_number ?? '—'}（{[vehicle.car_name, vehicle.car_model, vehicle.grade].filter(Boolean).join(' / ')}）
                </Link>
              ) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* メモ */}
      {(m.internal_memo || m.work_order_note || m.general_note) && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">メモ</h2>
          <div className="space-y-3 text-sm">
            {m.internal_memo && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">整備メモ（印字なし）</dt>
                <dd className="whitespace-pre-wrap text-zinc-800">{m.internal_memo}</dd>
              </div>
            )}
            {m.work_order_note && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">作業指示備考</dt>
                <dd className="whitespace-pre-wrap text-zinc-800">{m.work_order_note}</dd>
              </div>
            )}
            {m.general_note && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">備考</dt>
                <dd className="whitespace-pre-wrap text-zinc-800">{m.general_note}</dd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 税情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">税</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><dt className="text-xs text-zinc-400 mb-1">消費税区分</dt><dd className="text-sm text-zinc-800">{m.tax_mode}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">消費税端数</dt><dd className="text-sm text-zinc-800">{m.tax_rounding}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">レバーレート</dt><dd className="text-sm text-zinc-800">{m.lever_rate ? `¥${Number(m.lever_rate).toLocaleString()}` : '—'}</dd></div>
        </dl>
      </div>
    </>
  )

  // 2-5: 行アイテム / 諸費用 / 入金 / 帳票
  // 帳票はスタブ（Placeholder はファイル末尾にホイスト済み）

  // 売上額（税抜）= 行アイテム（除外除く）の労務+部品 + 諸費用合計
  const labor = Number(lineTotalsRow[0]?.labor ?? 0)
  const parts = Number(lineTotalsRow[0]?.parts ?? 0)
  const feesT = Number(feeTotalsRow[0]?.fees ?? 0)
  const invoiceTotal = labor + parts + feesT

  const linesContent = (
    <MaintenanceLineItemsEditor
      maintenanceId={id}
      canEdit={editable}
      leverRate={m.lever_rate}
    />
  )

  const feesContent = (
    <MaintenanceFeesEditor
      maintenanceId={id}
      canEdit={editable}
    />
  )

  const paymentsContent = (
    <MaintenancePaymentsEditor
      maintenanceId={id}
      canEdit={editable}
      users={allUsers}
      invoiceTotal={invoiceTotal}
    />
  )

  const overviewSubTabs: TabDef[] = [
    { id: 'basic',     label: '基本情報', content: basicInfoContent },
    { id: 'lines',     label: '行アイテム', content: linesContent },
    { id: 'fees',      label: '諸費用',     content: feesContent },
    { id: 'payments',  label: '入金',       content: paymentsContent },
    { id: 'documents', label: '帳票',       content: <Placeholder title="帳票" /> },
  ]

  const overviewContent = (
    <RecordTabs defaultTab="basic" tabs={overviewSubTabs} paramName="sub" />
  )

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

  // ── 全体ビュー（CarRide スタイル 1 画面伝票）─────────────────────
  const fullViewContent = (
    <MaintenanceFullView maintenanceId={id} users={allUsers} />
  )

  // ── メインタブ ──────────────────────────────────────────────────
  const tabsConfig: TabDef[] = [
    { id: 'overview',  label: '概要', content: overviewContent },
    { id: 'full',      label: '全体', content: fullViewContent },
  ]
  tabsConfig.push({
    id: 'interactions',
    label: '活動・ToDo・経費',
    badge: interactionCount > 0 ? interactionCount : undefined,
    content: interactionsContent,
  })
  if (changeLogCount > 0) {
    tabsConfig.push({ id: 'history', label: '履歴', badge: changeLogCount, content: historyContent })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <RecordHeader
        crumbs={[
          { label: '整備', href: '/maintenance' },
          { label: m.maintenance_no },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/maintenance/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この整備を削除しますか？関連する行アイテム・諸費用・入金もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 font-mono">{m.maintenance_no}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          {vehicle && (
            <Link href={`/customer-vehicles/${vehicle.id}`} className="hover:text-blue-600">
              🚗 {vehicle.plate_number ?? vehicle.car_model ?? '車両'}
            </Link>
          )}
          {account && (
            <>
              <span className="text-zinc-300">·</span>
              <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">🏢 {account.name}</Link>
            </>
          )}
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
