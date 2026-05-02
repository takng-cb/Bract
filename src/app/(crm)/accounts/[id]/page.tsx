import { db } from '@/lib/db'
import { accounts, contacts, opportunities, activities, tasks, attachments } from '@/lib/schema'
import { eq, asc, desc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { updateAccountStatus, deleteAccount } from '@/app/actions/accounts'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { toggleTaskDone } from '@/app/actions/tasks'
import TagsSection from '@/components/TagsSection'
import ChangeLogSection from '@/components/ChangeLogSection'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'

const ACCOUNT_STAGES: StageConfig[] = [
  { value: 'prospect', label: '見込み', activeColor: '#2563eb', pastColor: '#93c5fd' },
  { value: 'active',   label: '有効',   activeColor: '#16a34a', pastColor: '#86efac' },
  { value: 'inactive', label: '無効',   activeColor: '#71717a', pastColor: '#d4d4d8' },
]

const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

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

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [account, contactsList, opportunitiesList, activitiesList, tasksList, attachmentsList] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.id, id)).then((r) => r[0] ?? null),
    db.select().from(contacts).where(eq(contacts.account_id, id)).orderBy(desc(contacts.created_at)),
    db.select().from(opportunities).where(eq(opportunities.account_id, id)).orderBy(desc(opportunities.created_at)),
    db.select().from(activities).where(eq(activities.account_id, id)).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(eq(tasks.account_id, id)).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(attachments).where(eq(attachments.account_id, id)).orderBy(desc(attachments.created_at)),
  ])

  if (!account) notFound()

  async function changeStatus(status: string) {
    'use server'
    await updateAccountStatus(id, status)
  }

  async function handleDelete() {
    'use server'
    await deleteAccount(id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/accounts/${id}`)
  }

  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('account_id', id)
    formData.set('revalidate', `/accounts/${id}`)
    await uploadAttachment(formData)
  }

  async function deleteFile(formData: FormData) {
    'use server'
    const attachId = formData.get('attach_id') as string
    const path     = formData.get('storage_path') as string
    await deleteAttachment(attachId, path, `/accounts/${id}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/accounts" className="hover:text-zinc-600">取引先</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">{account.name}</span>
      </div>

      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 min-w-0 break-words">{account.name}</h1>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <Link href={`/accounts/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">編集</Link>
            <DeleteButton action={handleDelete} confirmMessage="この取引先を削除しますか？&#10;関連する担当者・商談・活動・ToDoも削除されます。" />
          </div>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          {[account.type, account.industry].filter(Boolean).join(' · ') || '業種未設定'}
        </p>
        <div className="mt-2">
          <TagsSection objectType="account" objectId={id} revalidatePath={`/accounts/${id}`} />
        </div>
      </div>

      <div className="mb-6 max-w-xs">
        <StageBar stages={ACCOUNT_STAGES} currentStage={account.status} updateAction={changeStatus} />
      </div>

      {/* 基本情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">基本情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: '電話番号', value: account.phone },
            { label: 'Webサイト', value: account.website, isLink: true },
            { label: '住所', value: account.address },
            { label: '従業員数', value: account.employee_count ? `${account.employee_count.toLocaleString()} 名` : null },
            { label: '年間売上', value: account.annual_revenue ? `¥${Number(account.annual_revenue).toLocaleString()}` : null },
            { label: '登録日', value: account.created_at ? new Date(account.created_at).toLocaleDateString('ja-JP') : '—' },
          ].map(({ label, value, isLink }) => (
            <div key={label}>
              <dt className="text-xs text-zinc-400 mb-1">{label}</dt>
              <dd className="text-sm text-zinc-800">
                {value ? (
                  isLink ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{value}</a>
                  ) : value
                ) : '—'}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">概要・メモ</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {account.description ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>
      </div>

      {/* 担当者 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">担当者 <span className="text-zinc-400 font-normal text-sm">({contactsList.length})</span></h2>
          <Link href={`/contacts/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
        </div>
        {contactsList.length > 0 ? (
          <>
            {/* PC: テーブル */}
            <div className="hidden md:block bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">氏名</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">役職・部署</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">メール</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">電話</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {contactsList.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 font-medium"><Link href={`/contacts/${c.id}`} className="hover:text-blue-600">{c.full_name}</Link></td>
                      <td className="px-4 py-2 text-zinc-500">{[c.title, c.department].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="px-4 py-2 text-zinc-500">{c.email ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-500">{c.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* モバイル: カード */}
            <div className="md:hidden space-y-2">
              {contactsList.map((c) => (
                <Link key={c.id} href={`/contacts/${c.id}`} className="block bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <p className="font-semibold text-zinc-900 text-sm">👤 {c.full_name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-zinc-500">
                    {(c.title || c.department) && <span>{[c.title, c.department].filter(Boolean).join(' / ')}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {c.phone && <span>📞 {c.phone}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">担当者がいません</p>
        )}
      </section>

      {/* 商談 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">商談 <span className="text-zinc-400 font-normal text-sm">({opportunitiesList.length})</span></h2>
          <Link href={`/opportunities/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
        </div>
        {opportunitiesList.length > 0 ? (
          <>
            {/* PC: テーブル */}
            <div className="hidden md:block bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">商談名</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">ステージ</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">金額</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">確度</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600">完了予定</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {opportunitiesList.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 font-medium"><Link href={`/opportunities/${o.id}`} className="hover:text-blue-600">{o.name}</Link></td>
                      <td className="px-4 py-2 text-zinc-500">{OPPORTUNITY_STAGE_LABELS[o.stage] ?? o.stage}</td>
                      <td className="px-4 py-2 text-zinc-500">{o.amount ? `¥${Number(o.amount).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-2 text-zinc-500">{o.probability != null ? `${o.probability}%` : '—'}</td>
                      <td className="px-4 py-2 text-zinc-500">{o.close_date ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* モバイル: カード */}
            <div className="md:hidden space-y-2">
              {opportunitiesList.map((o) => (
                <Link key={o.id} href={`/opportunities/${o.id}`} className="block bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900 text-sm leading-snug">{o.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{OPPORTUNITY_STAGE_LABELS[o.stage] ?? o.stage}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                    <span>{o.close_date ? `📅 ${o.close_date}` : '期限なし'}</span>
                    <div>
                      {o.amount && <span className="font-semibold text-zinc-700">¥{Number(o.amount).toLocaleString()}</span>}
                      {o.probability != null && <span className="ml-2">確度{o.probability}%</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">商談がありません</p>
        )}
      </section>

      {/* ToDo */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
          <Link href={`/tasks/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
        </div>
        {tasksList.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {tasksList.map((t) => {
              const priority  = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue = !t.done && t.due_date && new Date(t.due_date) < new Date()
              return (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 ${t.done ? 'opacity-60' : ''}`}>
                  <form action={toggleTask} className="shrink-0">
                    <input type="hidden" name="task_id" value={t.id} />
                    <input type="hidden" name="done" value={(!t.done).toString()} />
                    <button type="submit" className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${t.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                      {t.done && <span className="text-xs leading-none">✓</span>}
                    </button>
                  </form>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className={`text-sm hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>{t.title}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    {t.due_date && <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>📅 {new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}</p>}
                  </div>
                  <Link href={`/tasks/${t.id}/edit`} className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0">編集</Link>
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
          <Link href={`/activities/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
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
                  <form action={deleteFile}>
                    <input type="hidden" name="attach_id" value={f.id} />
                    <input type="hidden" name="storage_path" value={f.storage_path} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={uploadFile} className="px-4 py-3 border-t border-zinc-100 flex items-center gap-3">
            <input type="file" name="file" className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200" />
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shrink-0">アップロード</button>
          </form>
        </div>
      </section>

      {/* 変更履歴 */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">変更履歴</h2>
        <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
          <ChangeLogSection objectType="account" objectId={id} />
        </div>
      </section>
      <div className="text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
