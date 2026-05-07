import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records, accounts, contacts, activities, tasks, expenses } from '@/lib/schema'
import { eq, and, inArray, desc, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { deleteCustomRecord } from '@/app/actions/customRecords'
import { toggleTaskDone } from '@/app/actions/tasks'
import DeleteButton from '@/components/DeleteButton'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import { evalFormula } from '@/lib/formulaEval'

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: '📞 電話', email: '✉️ メール', meeting: '🤝 打合せ', note: '📝 メモ',
}
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

  const [obj, edit] = await Promise.all([
    getObjectDef(objectApiName),
    canEdit(),
  ])
  if (!obj) notFound()

  const [record, fields] = await Promise.all([
    db.select().from(custom_records)
      .where(and(eq(custom_records.id, recordId), eq(custom_records.object_id, obj.id)))
      .then((r) => r[0] ?? null),
    getFieldDefs(obj.id),
  ])
  if (!record) notFound()

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(record.data) } catch { /* ignore */ }

  const visibleFields = fields.filter((f) => f.is_visible)

  // ── account_id / contact_id フィールドの ID を一括ルックアップ ──
  const accountIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    visibleFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  const accountIdList = [...accountIdApiNames].map((an) => String(data[an] ?? '')).filter(Boolean)
  const contactIdList = [...contactIdApiNames].map((cn) => String(data[cn] ?? '')).filter(Boolean)

  // ── 有効化されている関連機能のデータを並列取得 ──
  const [accountRows, contactRows, activitiesList, tasksList, expensesList] = await Promise.all([
    accountIdList.length > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIdList))
      : Promise.resolve([]),
    contactIdList.length > 0
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).where(inArray(contacts.id, contactIdList))
      : Promise.resolve([]),
    obj.enable_activities
      ? db.select().from(activities).where(eq(activities.custom_record_id, recordId)).orderBy(desc(activities.occurred_at))
      : Promise.resolve([]),
    obj.enable_tasks
      ? db.select().from(tasks).where(eq(tasks.custom_record_id, recordId)).orderBy(asc(tasks.done), asc(tasks.due_date))
      : Promise.resolve([]),
    obj.enable_expenses
      ? db.select().from(expenses).where(eq(expenses.custom_record_id, recordId)).orderBy(desc(expenses.expense_date))
      : Promise.resolve([]),
  ])
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))
  const contactMap = new Map(contactRows.map((c) => [c.id, c.name]))

  const recordTitle = String(data.name ?? data.title ?? `${obj.label} #${recordId.slice(0, 8)}`)
  const returnTo    = `/objects/${objectApiName}/${recordId}`

  async function handleDelete() {
    'use server'
    await deleteCustomRecord(objectApiName, recordId)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, returnTo)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* パンくず＋アクション */}
      <div className="mb-6">
        <Link href={`/objects/${objectApiName}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← {obj.label_plural}
        </Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 break-words">
            {obj.icon} {recordTitle}
          </h1>
          {edit && (
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/objects/${objectApiName}/${recordId}/edit`}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                ✏️ 編集
              </Link>
              <DeleteButton
                action={handleDelete}
                confirmMessage={`この${obj.label}を削除しますか？`}
              />
            </div>
          )}
        </div>
      </div>

      {/* フィールド表示 */}
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
          <span>作成: {record.created_at ? new Date(record.created_at).toLocaleString('ja-JP') : '—'}</span>
          <span>更新: {record.updated_at ? new Date(record.updated_at).toLocaleString('ja-JP') : '—'}</span>
        </div>
      </div>

      {/* 関係性（多対多） */}
      <RelatedRecordsSection
        objectType={objectApiName}
        recordId={recordId}
        pagePath={returnTo}
      />

      {/* ── 活動履歴 ── */}
      {obj.enable_activities && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700">📋 活動履歴</h2>
            {edit && (
              <Link
                href={`/activities/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              >
                ＋ 活動を記録
              </Link>
            )}
          </div>
          {activitiesList.length === 0 ? (
            <p className="text-sm text-zinc-400">活動履歴がありません</p>
          ) : (
            <ul className="space-y-3">
              {activitiesList.map((act) => (
                <li key={act.id} className="flex gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                  <span className="text-lg shrink-0 mt-0.5">
                    {ACTIVITY_TYPE_LABELS[act.type]?.split(' ')[0] ?? '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/activities/${act.id}`} className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate block">
                      {act.subject}
                    </Link>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {ACTIVITY_TYPE_LABELS[act.type] ?? act.type}
                      {act.occurred_at && (
                        <> · {new Date(act.occurred_at).toLocaleDateString('ja-JP')}</>
                      )}
                    </p>
                    {act.body && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{act.body}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── ToDo ── */}
      {obj.enable_tasks && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700">✅ ToDo</h2>
            {edit && (
              <Link
                href={`/tasks/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              >
                ＋ ToDo を追加
              </Link>
            )}
          </div>
          {tasksList.length === 0 ? (
            <p className="text-sm text-zinc-400">ToDoがありません</p>
          ) : (
            <ul className="space-y-2">
              {tasksList.map((task) => {
                const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
                return (
                  <li key={task.id} className="flex items-center gap-3 py-1">
                    <form action={toggleTask}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="done" value={task.done ? 'false' : 'true'} />
                      <button
                        type="submit"
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          task.done ? 'bg-green-500 border-green-500' : 'border-zinc-300 hover:border-green-400'
                        }`}
                      >
                        {task.done && <span className="text-white text-xs font-bold">✓</span>}
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
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── 経費 ── */}
      {obj.enable_expenses && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700">💰 経費</h2>
            {edit && (
              <Link
                href={`/expenses/new?custom_record_id=${recordId}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              >
                ＋ 経費を追加
              </Link>
            )}
          </div>
          {expensesList.length === 0 ? (
            <p className="text-sm text-zinc-400">経費がありません</p>
          ) : (
            <>
              <ul className="space-y-2 mb-3">
                {expensesList.map((exp) => (
                  <li key={exp.id} className="flex items-center gap-3 py-1 border-b border-zinc-100 last:border-0">
                    <span className="text-xs text-zinc-400 shrink-0 w-20">{exp.expense_date}</span>
                    <Link href={`/expenses/${exp.id}`} className="flex-1 text-sm text-zinc-800 hover:text-blue-600 truncate">
                      {exp.title}
                    </Link>
                    <span className="text-xs text-zinc-500 shrink-0">{exp.category}</span>
                    <span className="text-sm font-semibold text-zinc-900 shrink-0">
                      ¥{Number(exp.amount).toLocaleString('ja-JP')}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-right text-sm font-semibold text-zinc-700">
                合計: ¥{expensesList.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('ja-JP')}
              </div>
            </>
          )}
        </div>
      )}
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
