import { db } from '@/lib/db'
import { contacts, accounts, activities, tasks, expenses, attachments, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, asc, desc, inArray, count } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { deleteContact } from '@/app/actions/contacts'
import { toggleTaskDone } from '@/app/actions/tasks'
import TagsSection from '@/components/TagsSection'
import ChangeLogSection from '@/components/ChangeLogSection'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import CustomFieldsCard from '@/components/CustomFieldsCard'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import { getActivityTypes } from '@/lib/activityTypes'

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

const EXPENSE_CATEGORY_COLOR: Record<string, string> = {
  交通費:   'bg-blue-50 text-blue-700',
  接待費:   'bg-purple-50 text-purple-700',
  通信費:   'bg-cyan-50 text-cyan-700',
  消耗品費: 'bg-yellow-50 text-yellow-700',
  広告費:   'bg-orange-50 text-orange-700',
  外注費:   'bg-red-50 text-red-700',
  その他:   'bg-zinc-100 text-zinc-600',
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [contact, activitiesList, tasksList, expensesList, attachmentsList, customData, , allUsers, activityTypes, changeLogCountRow] = await Promise.all([
    db.select({
      id: contacts.id, contact_type: contacts.contact_type, full_name: contacts.full_name, email: contacts.email,
      phone: contacts.phone, title: contacts.title, department: contacts.department,
      birthday: contacts.birthday, description: contacts.description,
      created_at: contacts.created_at, owner_id: contacts.owner_id,
      accounts: { id: accounts.id, name: accounts.name },
    })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(eq(contacts.id, id))
      .then((r) => r[0] ?? null),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('contact', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('contact', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('contact', id)))
      .orderBy(desc(expenses.expense_date)),
    db.select().from(attachments).where(eq(attachments.contact_id, id)).orderBy(desc(attachments.created_at)),
    getCustomFieldsWithValues('contacts', id),
    canEdit(),
    getAllUsers(),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'contact'), eq(change_logs.object_id, id))),
  ])

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  if (!contact) notFound()
  const account   = contact.accounts?.id ? contact.accounts : null
  const ownerName = contact.owner_id ? (allUsers.find((u) => u.id === contact.owner_id)?.name ?? null) : null
  const view      = contact.contact_type === 'consumer' ? 'consumer' : 'business'
  const isBiz     = view === 'business'

  async function handleDelete() {
    'use server'
    await deleteContact(id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/contacts/${id}`)
  }

  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('contact_id', id)
    formData.set('revalidate', `/contacts/${id}`)
    await uploadAttachment(formData)
  }

  async function deleteFile(formData: FormData) {
    'use server'
    const attachId = formData.get('attach_id') as string
    const path     = formData.get('storage_path') as string
    await deleteAttachment(attachId, path, `/contacts/${id}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // ── 概要タブ ─────────────────────────────────────────────────────
  const overviewContent = (
    <>
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">基本情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isBiz && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
              <dd className="text-sm text-zinc-800">
                {account ? <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">{account.name}</Link> : '—'}
              </dd>
            </div>
          )}
          {isBiz && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">役職</dt>
              <dd className="text-sm text-zinc-800">{contact.title ?? '—'}</dd>
            </div>
          )}
          {isBiz && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">部署</dt>
              <dd className="text-sm text-zinc-800">{contact.department ?? '—'}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-zinc-400 mb-1">誕生日</dt>
            <dd className="text-sm text-zinc-800">
              {contact.birthday ? new Date(contact.birthday).toLocaleDateString('ja-JP') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">メールアドレス</dt>
            <dd className="text-sm text-zinc-800">
              {contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a> : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">電話番号</dt>
            <dd className="text-sm text-zinc-800">{contact.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
            <dd className="text-sm text-zinc-800">{ownerName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{contact.created_at ? new Date(contact.created_at).toLocaleDateString('ja-JP') : '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">メモ</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {contact.description ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>
      </div>

      {customData.fields.length > 0 && (
        <div className="mb-6">
          <CustomFieldsCard fields={customData.fields} values={customData.values} />
        </div>
      )}

      {/* 添付ファイル */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">添付ファイル <span className="text-zinc-400 font-normal text-sm">({attachmentsList.length})</span></h2>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {attachmentsList.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {attachmentsList.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="text-xl shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <a href={`${supabaseUrl}/storage/v1/object/public/attachments/${f.storage_path}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">{f.file_name}</a>
                    <p className="text-xs text-zinc-400">{formatFileSize(f.file_size)} · {f.created_at ? new Date(f.created_at).toLocaleDateString('ja-JP') : ''}</p>
                  </div>
                  <AuthGuard minRole="editor">
                    <form action={deleteFile}>
                      <input type="hidden" name="attach_id" value={f.id} />
                      <input type="hidden" name="storage_path" value={f.storage_path} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
                    </form>
                  </AuthGuard>
                </div>
              ))}
            </div>
          )}
          <AuthGuard minRole="editor">
            <form action={uploadFile} className="px-4 py-3 border-t border-zinc-100 flex items-center gap-3">
              <input type="file" name="file" className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200" />
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shrink-0">アップロード</button>
            </form>
          </AuthGuard>
        </div>
      </section>
    </>
  )

  // ── 活動・ToDo・経費タブ ───────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      <AuthGuard minRole="editor">
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/activities/new?contact_id=${id}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          <Link href={`/tasks/new?contact_id=${id}`}      className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          <Link href={`/expenses/new?contact_id=${id}`}   className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
        </div>
      </AuthGuard>
    </div>
  ) : (
    <>
      {activitiesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">活動履歴 <span className="text-zinc-400 font-normal text-sm">({activitiesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/activities/new?contact_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
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
              </div>
            ))}
          </div>
        </section>
      )}

      {tasksList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/tasks/new?contact_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
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
                      <button type="submit" className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${t.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                        {t.done && <span className="text-xs leading-none">✓</span>}
                      </button>
                    </form>
                  </AuthGuard>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className={`text-sm hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>{t.title}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    {t.due_date && <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>📅 {new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}</p>}
                  </div>
                  <AuthGuard minRole="editor">
                    <Link href={`/tasks/${t.id}/edit`} className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0">編集</Link>
                  </AuthGuard>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {expensesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">経費 <span className="text-zinc-400 font-normal text-sm">({expensesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/expenses/new?contact_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expensesList.map((e) => {
              const catColor = EXPENSE_CATEGORY_COLOR[e.category] ?? EXPENSE_CATEGORY_COLOR['その他']
              return (
                <Link key={e.id} href={`/expenses/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-800">{e.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor}`}>{e.category}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">📅 {e.expense_date}</p>
                  </div>
                  <span className="font-bold text-zinc-800 text-sm shrink-0">¥{Number(e.amount).toLocaleString()}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </>
  )

  // ── 履歴タブ ─────────────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType="contact" objectId={id} />
    </div>
  )

  const tabsConfig: TabDef[] = [
    { id: 'overview', label: '概要', content: overviewContent },
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
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[
          { label: '人物', href: `/contacts?view=${view}` },
          { label: contact.full_name },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/contacts/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この人物を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{contact.full_name}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {isBiz
            ? [contact.title, contact.department].filter(Boolean).join(' · ') || '役職未設定'
            : '個人顧客'}
        </p>
        <div className="mt-2">
          <TagsSection objectType="contact" objectId={id} revalidatePath={`/contacts/${id}`} />
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
