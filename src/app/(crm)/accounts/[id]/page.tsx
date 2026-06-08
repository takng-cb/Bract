import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import { accounts, contacts, opportunities, activities, tasks, expenses, attachments, change_logs } from '@/lib/schema'
import { activeIndustry } from '@/lib/industry'
import { getActivityTypes } from '@/lib/activityTypes'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import { eq, and, asc, desc, inArray, count } from 'drizzle-orm'
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
import AuthGuard from '@/components/AuthGuard'
import CustomFieldsCard from '@/components/CustomFieldsCard'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import TextImportModal from '@/components/TextImportModal'
import RecordHeader from '@/components/RecordHeader'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'

const ACCOUNT_STAGES: StageConfig[] = [
  { value: 'prospect', label: '見込み', activeColor: '#2563eb', pastColor: '#93c5fd' },
  { value: 'active',   label: '有効',   activeColor: '#16a34a', pastColor: '#86efac' },
  { value: 'inactive', label: '無効',   activeColor: '#71717a', pastColor: '#d4d4d8' },
]

const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

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

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [account, contactsList, opportunitiesList, activitiesList, tasksList, expensesList, attachmentsList, customData, editFlag, allUsers, activityTypes, changeLogCountRow] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.id, id)).then((r) => r[0] ?? null),
    db.select().from(contacts).where(eq(contacts.account_id, id)).orderBy(desc(contacts.created_at)),
    db.select().from(opportunities).where(eq(opportunities.account_id, id)).orderBy(desc(opportunities.created_at)),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('account', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('account', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('account', id)))
      .orderBy(desc(expenses.expense_date)),
    db.select().from(attachments).where(eq(attachments.account_id, id)).orderBy(desc(attachments.created_at)),
    getCustomFieldsWithValues('accounts', id),
    canEdit(),
    getAllUsers(),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'account'), eq(change_logs.object_id, id))),
  ])

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  if (!account) notFound()

  // 各活動・ToDo・経費の「他の関連先」を一括取得
  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'account' && r.record_id === id)

  // 編集権限ボイラープレートを抑制（hint だけに使う）
  void editFlag

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

  // ── 概要タブの中身 ──────────────────────────────────────────────
  const overviewContent = (
    <>
      <div className="mb-6 max-w-xs">
        <StageBar stages={ACCOUNT_STAGES} currentStage={account.status} updateAction={changeStatus} />
      </div>

      {/* 基本情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">基本情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: '電話番号', value: account.phone },
            { label: 'Webサイト', value: account.website, isLink: true },
            { label: '住所', value: account.address },
            { label: '従業員数', value: account.employee_count ? `${account.employee_count.toLocaleString()} 名` : null },
            { label: '年間売上', value: account.annual_revenue ? `¥${Number(account.annual_revenue).toLocaleString()}` : null },
            { label: '担当者', value: account.owner_id ? (allUsers.find((u) => u.id === account.owner_id)?.name ?? '—') : null },
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

      {/* カスタムフィールド */}
      {customData.fields.length > 0 && (
        <div className="mb-6">
          <CustomFieldsCard
            fields={customData.fields}
            values={customData.values}
          />
        </div>
      )}

      {/* 人物 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">人物 <span className="text-zinc-400 font-normal text-sm">({contactsList.length})</span></h2>
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <TextImportModal importUrl="/api/import/contacts" title="人物インポート" csvFormat="ID,氏名,役職,部署,メール,電話番号,誕生日,メモ" defaultContext={{ account_id: id }} />
              <Link href={`/contacts/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </div>
          </AuthGuard>
        </div>
        {contactsList.length > 0 ? (
          <>
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
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">人物がいません</p>
        )}
      </section>

      {/* 商談 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">商談 <span className="text-zinc-400 font-normal text-sm">({opportunitiesList.length})</span></h2>
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <TextImportModal
                importUrl="/api/import/opportunities"
                title="商談インポート"
                csvFormat={activeIndustry === 'real-estate'
                  ? "ID,商談名,ステージ,金額,完了予定日,確度(%),説明,取引区分,仲介手数料,仲介種別,その他利益"
                  : "ID,商談名,ステージ,金額,完了予定日,確度(%),説明"}
                fieldOptions={{
                  'ステージ': ['見込み','要件確認','提案','交渉','受注','失注'],
                  ...(activeIndustry === 'real-estate' ? {
                    '取引区分': ['売買','賃貸'],
                    '仲介種別': ['両手','売り','買い','貸主','借主'],
                  } : {}),
                }}
                defaultContext={{ account_id: id }}
              />
              <Link href={`/opportunities/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </div>
          </AuthGuard>
        </div>
        {opportunitiesList.length > 0 ? (
          <>
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

  // ── 活動・ToDo・経費タブの中身 ────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      <AuthGuard minRole="editor">
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/activities/new?account_id=${id}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          <Link href={`/tasks/new?account_id=${id}`}      className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          <Link href={`/expenses/new?account_id=${id}`}   className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
        </div>
      </AuthGuard>
    </div>
  ) : (
    <>
      {/* 活動履歴 */}
      {activitiesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">活動履歴 <span className="text-zinc-400 font-normal text-sm">({activitiesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/activities/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
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
                <OtherRelationsChips relations={(activityRelMap.get(a.id) ?? []).filter(isNotSelf)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ToDo */}
      {tasksList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/tasks/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
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
                    <OtherRelationsChips relations={(taskRelMap.get(t.id) ?? []).filter(isNotSelf)} />
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

      {/* 経費 */}
      {expensesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">経費 <span className="text-zinc-400 font-normal text-sm">({expensesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/expenses/new?account_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expensesList.map((e) => {
              const catColor = EXPENSE_CATEGORY_COLOR[e.category] ?? EXPENSE_CATEGORY_COLOR['その他']
              return (
                <div key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                  <Link href={`/expenses/${e.id}`} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800">{e.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor}`}>{e.category}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">📅 {e.expense_date}</p>
                    </div>
                    <span className="font-bold text-zinc-800 text-sm shrink-0">¥{Number(e.amount).toLocaleString()}</span>
                  </Link>
                  <OtherRelationsChips relations={(expenseRelMap.get(e.id) ?? []).filter(isNotSelf)} />
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )

  // ── 履歴タブの中身 ──────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType="account" objectId={id} />
    </div>
  )

  // ── タブ配列を組み立て（中身が空なら除外） ───────────────────────
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
    tabsConfig.push({
      id: 'history',
      label: '履歴',
      badge: changeLogCount,
      content: historyContent,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <RecordHeader
        crumbs={[
          { label: '取引先', href: '/accounts' },
          { label: account.name },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/accounts/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この取引先を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{account.name}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {[account.type, account.industry].filter(Boolean).join(' · ') || '業種未設定'}
        </p>
        <div className="mt-2">
          <TagsSection objectType="account" objectId={id} revalidatePath={`/accounts/${id}`} />
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
