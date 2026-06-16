import { getBookDef, getFieldDefs } from '@/lib/bookMetadata'
import { db } from '@/lib/db'
import { book_records, accounts, contacts, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import { eq, and, inArray, desc, asc, count } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { canEdit } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { deleteCustomRecord, updateCustomRecord } from '@/app/actions/customRecords'
import { toggleTaskDone } from '@/app/actions/tasks'
import DeleteButton from '@/components/DeleteButton'
import DynamicForm from '@/components/DynamicForm'
import InlineFormToggle from '@/components/detail/InlineFormToggle'
import InlineEditButton from '@/components/detail/InlineEditButton'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import RecordLinksSection from '@/components/RecordLinksSection'
import ChangeLogSection from '@/components/ChangeLogSection'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import { evalFormula } from '@/lib/formulaEval'
import { getActivityTypes } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

export default async function CustomRecordDetailPage({
  params,
}: {
  params: Promise<{ objectApiName: string; recordId: string }>
}) {
  const { objectApiName, recordId } = await params
  await requireBookRead(objectApiName)  // RBAC: Read 権限ガード（ADR-0023）

  const [obj, edit, allUsers] = await Promise.all([
    getBookDef(objectApiName),
    canEdit(),
    getAllUsers(),
  ])
  if (!obj) notFound()

  const [record, fields] = await Promise.all([
    db.select().from(book_records)
      .where(and(eq(book_records.id, recordId), eq(book_records.object_id, obj.id)))
      .then((r) => r[0] ?? null),
    getFieldDefs(obj.id),
  ])
  if (!record) notFound()

  const data: Record<string, unknown> = record.data ?? {}
  const visibleFields = fields.filter((f) => f.is_visible)

  const accountIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  const accountIdList = [...accountIdApiNames].map((an) => String(data[an] ?? '')).filter(Boolean)
  const contactIdList = [...contactIdApiNames].map((cn) => String(data[cn] ?? '')).filter(Boolean)

  const [accountRows, contactRows, activitiesList, tasksList, expensesList, activityTypes, changeLogCountRow] = await Promise.all([
    accountIdList.length > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIdList))
      : Promise.resolve([]),
    contactIdList.length > 0
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).where(inArray(contacts.id, contactIdList))
      : Promise.resolve([]),
    obj.enable_activities
      ? db.select().from(activities)
          .where(inArray(activities.id, activityIdsRelatedTo(objectApiName, recordId)))
          .orderBy(desc(activities.occurred_at))
      : Promise.resolve([]),
    obj.enable_tasks
      ? db.select().from(tasks)
          .where(inArray(tasks.id, taskIdsRelatedTo(objectApiName, recordId)))
          .orderBy(asc(tasks.done), asc(tasks.due_date))
      : Promise.resolve([]),
    obj.enable_expenses
      ? db.select().from(expenses)
          .where(inArray(expenses.id, expenseIdsRelatedTo(objectApiName, recordId)))
          .orderBy(desc(expenses.expense_date))
      : Promise.resolve([]),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, objectApiName), eq(change_logs.object_id, recordId))),
  ])
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))
  const contactMap = new Map(contactRows.map((c) => [c.id, c.name]))
  const ACTIVITY_TYPE_LABELS: Record<string, { icon: string; label: string }> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = { icon: t.icon, label: t.label }

  const recordTitle = String(data.name ?? data.title ?? `${obj.label} #${recordId.slice(0, 8)}`)
  const returnTo    = `/books/${objectApiName}/${recordId}`

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === objectApiName && r.record_id === recordId)

  // インライン編集用：フォームのピッカー用に取引先・人物の全件を取得（該当フィールドがある時のみ）
  const hasAccountField = accountIdApiNames.size > 0
  const hasContactField = contactIdApiNames.size > 0
  const [accountOptionsList, contactOptionsList] = await Promise.all([
    hasAccountField ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(asc(accounts.name)) : Promise.resolve([] as { id: string; name: string }[]),
    hasContactField ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).orderBy(asc(contacts.full_name)) : Promise.resolve([] as { id: string; name: string }[]),
  ])

  async function handleDelete() {
    'use server'
    await deleteCustomRecord(objectApiName, recordId)
  }

  async function handleUpdate(_prev: unknown, fd: FormData) {
    'use server'
    await updateCustomRecord(objectApiName, recordId, fd)
  }

  // インライン編集フォーム（既存 DynamicForm を再利用）
  const editForm = (
    <div className="bg-white rounded-lg border border-brand-300 shadow-xs p-6 mb-6">
      <DynamicForm
        fields={fields}
        defaultValues={data}
        action={handleUpdate}
        submitLabel="保存"
        cancelHref={returnTo}
        accountOptions={hasAccountField ? accountOptionsList.map((a) => ({ value: a.id, label: a.name })) : undefined}
        contactOptions={hasContactField ? contactOptionsList.map((c) => ({ value: c.id, label: c.name })) : undefined}
        userOptions={allUsers.map((u) => ({ value: u.id, label: u.name }))}
        defaultOwnerId={record.owner_id ?? null}
      />
    </div>
  )

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, returnTo)
  }

  // ── 概要タブ ─────────────────────────────────────────────────────
  const overviewContent = (
    <>
      <InlineFormToggle canEdit={edit} form={editForm} view={
      <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
        {visibleFields.length === 0 ? (
          <p className="text-sm text-zinc-400">フィールドが定義されていません。管理画面でフィールドを追加してください。</p>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {visibleFields.map((field) => {
              if (field.field_type === 'section') {
                return (
                  <div key={field.id} className="col-span-full pt-3 pb-1 border-b-2 border-zinc-100">
                    <p className="text-sm font-semibold text-zinc-600">{field.label}</p>
                  </div>
                )
              }
              const val = data[field.api_name]

              if (accountIdApiNames.has(field.api_name)) {
                const id = String(val ?? '').trim()
                const name = id ? accountMap.get(id) : null
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                      {field.label.replace(/ ?ID$/, '')}
                    </dt>
                    <dd className="text-sm text-zinc-800">
                      {name
                        ? <Link href={`/accounts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
                        : id || '—'
                      }
                    </dd>
                  </div>
                )
              }

              if (contactIdApiNames.has(field.api_name)) {
                const id = String(val ?? '').trim()
                const name = id ? contactMap.get(id) : null
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                      {field.label.replace(/ ?ID$/, '')}
                    </dt>
                    <dd className="text-sm text-zinc-800">
                      {name
                        ? <Link href={`/contacts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
                        : id || '—'
                      }
                    </dd>
                  </div>
                )
              }

              if (field.field_type === 'formula') {
                const computed = evalFormula(field.options ?? '', data)
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                      {field.label}
                      <span className="ml-1.5 text-violet-400 normal-case font-normal">数式</span>
                    </dt>
                    <dd className="text-sm text-zinc-800">
                      {computed !== '' ? Number(computed).toLocaleString('ja-JP') : '—'}
                    </dd>
                  </div>
                )
              }

              return (
                <div key={field.id} className={field.field_type === 'textarea' ? 'col-span-full' : ''}>
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                    {field.label}
                  </dt>
                  <dd className="text-sm text-zinc-800">
                    {formatDetailValue(field.field_type, val)}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-100 flex gap-6 text-xs text-zinc-400">
          {record.owner_id && (
            <span>担当者: {allUsers.find((u) => u.id === record.owner_id)?.name ?? '—'}</span>
          )}
          <span>作成: {record.created_at ? new Date(record.created_at).toLocaleString('ja-JP') : '—'}</span>
          <span>更新: {record.updated_at ? new Date(record.updated_at).toLocaleString('ja-JP') : '—'}</span>
        </div>
      </div>
      } />

      {/* 関係性（多対多） */}
      <RelatedRecordsSection
        objectType={objectApiName}
        recordId={recordId}
        pagePath={returnTo}
      />

      {/* 関連先（汎用リンク。REQ-0078） */}
      <RecordLinksSection selfApi={objectApiName} selfId={recordId} />
    </>
  )

  // ── 活動・ToDo・経費タブ ───────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      {edit && (
        <div className="flex flex-wrap justify-center gap-2">
          {obj.enable_activities && (
            <Link href={`/activities/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          )}
          {obj.enable_tasks && (
            <Link href={`/tasks/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          )}
          {obj.enable_expenses && (
            <Link href={`/expenses/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
          )}
        </div>
      )}
    </div>
  ) : (
    <>
      {obj.enable_activities && activitiesList.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2"><NavIcon icon="📋" className="w-4 h-4" /> 活動履歴 <span className="text-zinc-400 font-normal ml-1">({activitiesList.length})</span></h2>
            {edit && (
              <Link
                href={`/activities/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              >
                ＋ 活動を記録
              </Link>
            )}
          </div>
          <ul className="space-y-3">
            {activitiesList.map((act) => (
              <li key={act.id} className="flex gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                <span className="shrink-0 mt-0.5 text-zinc-400">
                  <NavIcon icon={ACTIVITY_TYPE_LABELS[act.type]?.icon ?? '📋'} className="w-4.5 h-4.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/activities/${act.id}`} className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate block">
                    {act.subject}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {ACTIVITY_TYPE_LABELS[act.type]?.label ?? act.type}
                    {act.occurred_at && (
                      <> · {new Date(act.occurred_at).toLocaleDateString('ja-JP')}</>
                    )}
                  </p>
                  {act.body && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{act.body}</p>}
                  <OtherRelationsChips relations={(activityRelMap.get(act.id) ?? []).filter(isNotSelf)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {obj.enable_tasks && tasksList.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2"><NavIcon icon="✅" className="w-4 h-4" /> ToDo <span className="text-zinc-400 font-normal ml-1">({tasksList.length})</span></h2>
            {edit && (
              <Link
                href={`/tasks/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              >
                ＋ ToDo を追加
              </Link>
            )}
          </div>
          <ul className="space-y-2">
            {tasksList.map((task) => {
              const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
              return (
                <li key={task.id} className="py-1">
                  <div className="flex items-center gap-3">
                    <form action={toggleTask}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="done" value={task.done ? 'false' : 'true'} />
                      <button
                        type="submit"
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          task.done ? 'bg-green-500 border-green-500' : 'border-zinc-300 hover:border-green-400'
                        }`}
                      >
                        {task.done && <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden />}
                      </button>
                    </form>
                    <Link href={`/tasks/${task.id}`} className={`flex-1 text-sm ${task.done ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                      {task.title}
                    </Link>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pri.color}`}>
                      {pri.label}
                    </span>
                    {task.due_date && (
                      <span className={`text-xs ${new Date(task.due_date) < new Date() && !task.done ? 'text-red-500' : 'text-zinc-400'}`}>
                        {task.due_date}
                      </span>
                    )}
                  </div>
                  <div className="ml-8">
                    <OtherRelationsChips relations={(taskRelMap.get(task.id) ?? []).filter(isNotSelf)} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {obj.enable_expenses && expensesList.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2"><NavIcon icon="💰" className="w-4 h-4" /> 経費 <span className="text-zinc-400 font-normal ml-1">({expensesList.length})</span></h2>
            {edit && (
              <Link
                href={`/expenses/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              >
                ＋ 経費を追加
              </Link>
            )}
          </div>
          <ul className="space-y-2 mb-3">
            {expensesList.map((exp) => (
              <li key={exp.id} className="py-1 border-b border-zinc-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 shrink-0 w-20">{exp.expense_date}</span>
                  <Link href={`/expenses/${exp.id}`} className="flex-1 text-sm text-zinc-800 hover:text-blue-600 truncate">
                    {exp.title}
                  </Link>
                  <span className="text-xs text-zinc-500 shrink-0">{exp.category}</span>
                  <span className="text-sm font-semibold text-zinc-900 shrink-0">
                    ¥{Number(exp.amount).toLocaleString('ja-JP')}
                  </span>
                </div>
                <div className="ml-23">
                  <OtherRelationsChips relations={(expenseRelMap.get(exp.id) ?? []).filter(isNotSelf)} />
                </div>
              </li>
            ))}
          </ul>
          <div className="text-right text-sm font-semibold text-zinc-700">
            合計: ¥{expensesList.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('ja-JP')}
          </div>
        </div>
      )}
    </>
  )

  // ── 履歴タブ ─────────────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType={objectApiName} objectId={recordId} />
    </div>
  )

  const tabsConfig: TabDef[] = [
    { id: 'overview', label: '概要', content: overviewContent },
  ]
  // 活動・ToDo・経費 のいずれかが有効化されている、またはデータがあるなら表示
  const showInteractionsTab = interactionCount > 0 || obj.enable_activities || obj.enable_tasks || obj.enable_expenses
  if (showInteractionsTab) {
    tabsConfig.push({
      id: 'interactions',
      label: '活動・ToDo・経費',
      badge: interactionCount > 0 ? interactionCount : undefined,
      content: interactionsContent,
    })
  }
  if (changeLogCount > 0) {
    tabsConfig.push({ id: 'history', label: '履歴', badge: changeLogCount, content: historyContent })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* パンくず＋アクション */}
      <div className="mb-6">
        <Link href={`/books/${objectApiName}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← {obj.label_plural}
        </Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 flex items-start gap-2">
            <NavIcon icon={obj.icon} className="w-6 h-6 shrink-0 mt-1" />
            <span className="min-w-0 wrap-break-word">{recordTitle}</span>
          </h1>
          {edit && (
            <div className="flex gap-2 shrink-0">
              <InlineEditButton />
              <DeleteButton
                action={handleDelete}
                confirmMessage={`この${obj.label}を削除しますか？`}
              />
            </div>
          )}
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />
    </div>
  )
}

function formatDetailValue(fieldType: string, value: unknown): React.ReactNode {
  if (value == null || value === '') return '—'
  switch (fieldType) {
    case 'boolean': return value ? 'はい' : 'いいえ'
    case 'number':  return Number(value).toLocaleString('ja-JP')
    case 'date':    return new Date(String(value)).toLocaleDateString('ja-JP')
    default:        return String(value)
  }
}
