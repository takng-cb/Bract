import { db } from '@/lib/db'
import { contacts, accounts, activities, tasks, attachments } from '@/lib/schema'
import { eq, asc, desc } from 'drizzle-orm'
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
import { canEdit } from '@/lib/auth'

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: '📞 電話', email: '✉️ メール', meeting: '🤝 打合せ', note: '📝 メモ',
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
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

  const [contact, activitiesList, tasksList, attachmentsList, customData, editFlag] = await Promise.all([
    db.select({
      id: contacts.id, contact_type: contacts.contact_type, full_name: contacts.full_name, email: contacts.email,
      phone: contacts.phone, title: contacts.title, department: contacts.department,
      birthday: contacts.birthday, description: contacts.description,
      created_at: contacts.created_at,
      accounts: { id: accounts.id, name: accounts.name },
    })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(eq(contacts.id, id))
      .then((r) => r[0] ?? null),
    db.select().from(activities).where(eq(activities.contact_id, id)).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(eq(tasks.contact_id, id)).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(attachments).where(eq(attachments.contact_id, id)).orderBy(desc(attachments.created_at)),
    getCustomFieldsWithValues('contacts', id),
    canEdit(),
  ])

  if (!contact) notFound()
  const account   = contact.accounts?.id ? contact.accounts : null
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

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href={`/contacts?view=${view}`} className="hover:text-zinc-600">人物</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">{contact.full_name}</span>
      </div>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 min-w-0 break-words">{contact.full_name}</h1>
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <Link href={`/contacts/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この人物を削除しますか？" />
            </div>
          </AuthGuard>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          {isBiz
            ? [contact.title, contact.department].filter(Boolean).join(' · ') || '役職未設定'
            : '個人顧客'}
        </p>
        <div className="mt-2">
          <TagsSection objectType="contact" objectId={id} revalidatePath={`/contacts/${id}`} />
        </div>
      </div>

      {/* 基本情報 */}
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

      {/* カスタムフィールド */}
      {customData.fields.length > 0 && (
        <div className="mb-6">
          <CustomFieldsCard
            fields={customData.fields}
            values={customData.values}
          />
        </div>
      )}

      {/* ToDo */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
          <AuthGuard minRole="editor"><Link href={`/tasks/new?contact_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link></AuthGuard>
        </div>
        {tasksList.length > 0 ? (
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
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">ToDoがありません</p>
        )}
      </section>

      {/* 活動履歴 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">活動履歴 <span className="text-zinc-400 font-normal text-sm">({activitiesList.length})</span></h2>
          <AuthGuard minRole="editor"><Link href={`/activities/new?contact_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link></AuthGuard>
        </div>
        {activitiesList.length > 0 ? (
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
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">活動履歴がありません</p>
        )}
      </section>

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

      {/* 変更履歴 */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">変更履歴</h2>
        <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
          <ChangeLogSection objectType="contact" objectId={id} />
        </div>
      </section>
      <div className="text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
