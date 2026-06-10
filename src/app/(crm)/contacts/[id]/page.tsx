import { db } from '@/lib/db'
import { UserRound, Building2, Briefcase, CalendarDays, Mail, Phone, Contact, Tag } from 'lucide-react'
import { contacts, accounts, activities, tasks, expenses, attachments, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import { eq, and, asc, desc, inArray, count } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { deleteContact, updateContact } from '@/app/actions/contacts'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
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
import { NavIcon } from '@/lib/navIcon'

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

  const [contact, activitiesList, tasksList, expensesList, attachmentsList, customData, canEditFlag, allUsers, activityTypes, changeLogCountRow, accountsList] = await Promise.all([
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
    db.select({ id: accounts.id, name: accounts.name }).from(accounts)
      .where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
  ])

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  if (!contact) notFound()

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'contact' && r.record_id === id)
  const account   = contact.accounts?.id ? contact.accounts : null
  const ownerName = contact.owner_id ? (allUsers.find((u) => u.id === contact.owner_id)?.name ?? null) : null
  const view      = contact.contact_type === 'consumer' ? 'consumer' : 'business'
  const isBiz     = view === 'business'

  async function handleDelete() {
    'use server'
    await deleteContact(id)
  }

  // 基本情報のインライン編集（更新後 updateContact が同URLへ redirect ＝閲覧へ戻る）
  async function saveContactInline(formData: FormData) {
    'use server'
    await updateContact(id, formData)
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
      <EditableInfoCard
        title="基本情報"
        canEdit={canEditFlag}
        showEditButton={false}
        action={saveContactInline}
        hiddenFields={[
          { name: 'full_name', value: contact.full_name },
          { name: 'contact_type', value: contact.contact_type ?? 'business' },
        ]}
        fields={[
          ...(isBiz ? [{
            label: '取引先', name: 'account_id', kind: 'select' as const,
            value: account?.id ?? '',
            options: accountsList.map((a) => ({ value: a.id, label: a.name })),
            view: account ? <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">{account.name}</Link> : '—',
          }] : []),
          ...(isBiz ? [{ label: '役職', name: 'title', kind: 'text' as const, value: contact.title, view: contact.title ?? '—' }] : []),
          ...(isBiz ? [{ label: '部署', name: 'department', kind: 'text' as const, value: contact.department, view: contact.department ?? '—' }] : []),
          { label: '誕生日', name: 'birthday', kind: 'date' as const, value: contact.birthday ? String(contact.birthday).slice(0, 10) : '', view: contact.birthday ? new Date(contact.birthday).toLocaleDateString('ja-JP') : '—' },
          { label: 'メールアドレス', name: 'email', kind: 'email' as const, value: contact.email, view: contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a> : '—' },
          { label: '電話番号', name: 'phone', kind: 'tel' as const, value: contact.phone, view: contact.phone ?? '—' },
          { label: '担当者', name: 'owner_id', kind: 'select' as const, value: contact.owner_id ?? '', options: allUsers.map((u) => ({ value: u.id, label: u.name })), view: ownerName ?? '—' },
          { label: '登録日', view: contact.created_at ? new Date(contact.created_at).toLocaleDateString('ja-JP') : '—' },
          { label: 'メモ', name: 'description', kind: 'textarea' as const, value: contact.description, fullWidth: true, view: contact.description ? contact.description : <span className="text-zinc-300">—</span> },
        ]}
      />

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
                  <NavIcon icon="📄" className="w-5 h-5 shrink-0 text-zinc-400" />
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
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-8 text-center">
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
                <OtherRelationsChips relations={(activityRelMap.get(a.id) ?? []).filter(isNotSelf)} />
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
                    {t.due_date && <p className={`text-xs mt-0.5 inline-flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}><NavIcon icon="📅" className="w-3 h-3 shrink-0" />{new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}</p>}
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
                <div key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                  <Link href={`/expenses/${e.id}`} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800">{e.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor}`}>{e.category}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 inline-flex items-center gap-1"><NavIcon icon="📅" className="w-3 h-3 shrink-0" />{e.expense_date}</p>
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
    <div className="p-4 md:p-8 max-w-6xl">
      <RecordHeader
        crumbs={[
          { label: '人物', href: `/contacts?view=${view}` },
          { label: contact.full_name },
        ]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={contact.full_name}
        badges={
          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${isBiz ? 'bg-blue-100 text-blue-700' : 'bg-brand-100 text-brand-700'}`}>{isBiz ? '法人担当者' : '個人顧客'}</span>
        }
        meta={[
          ...(isBiz && account ? [{ icon: <Building2 className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '取引先', value: account.name }] : []),
          ...(isBiz && [contact.title, contact.department].filter(Boolean).length > 0
            ? [{ icon: <Briefcase className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: [contact.title, contact.department].filter(Boolean).join(' / ') }] : []),
          ...(ownerName ? [{ icon: <UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '担当', value: ownerName }] : []),
          ...(contact.created_at ? [{ icon: <CalendarDays className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '登録', value: new Date(contact.created_at).toLocaleDateString('ja-JP') }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton />
              <DeleteButton action={handleDelete} confirmMessage="この人物を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">
          <RecordTabs defaultTab="overview" tabs={tabsConfig} />
          <div className="mt-6 text-right">
            <RecordId id={id} />
          </div>
        </div>

        {/* 右レール（design_handoff: Detail rail） */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {ownerName && (
            <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 mb-3"><UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />担当者</h4>
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-brand-600 text-white text-sm font-bold shrink-0">{ownerName.trim()[0]}</span>
                <span className="text-sm font-semibold text-zinc-900 truncate">{ownerName}</span>
              </div>
            </div>
          )}

          {(contact.email || contact.phone || account) && (
            <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 mb-3"><Contact className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />連絡先</h4>
              <div className="space-y-2 text-sm text-zinc-700">
                {contact.email && <div className="flex items-center gap-2 min-w-0"><Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2.25} aria-hidden /><a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">{contact.email}</a></div>}
                {contact.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2.25} aria-hidden /><span className="tabular-nums">{contact.phone}</span></div>}
                {account && <div className="flex items-center gap-2 min-w-0"><Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2.25} aria-hidden /><Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline truncate">{account.name}</Link></div>}
              </div>
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 mb-3"><Tag className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />タグ</h4>
            <TagsSection objectType="contact" objectId={id} revalidatePath={`/contacts/${id}`} />
          </div>
        </aside>
      </div>
    </div>
  )
}
