import { db } from '@/lib/db'
import { UserRound, Building2, Briefcase, CalendarDays, Mail, Phone, Contact, Tag, Activity, SquareCheckBig, Receipt, Folder, Check } from 'lucide-react'
import { contacts, accounts, activities, tasks, expenses, attachments, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { deleteContact, updateContact } from '@/app/actions/contacts'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import InlineComposer from '@/components/record/InlineComposer'
import TagsSection from '@/components/TagsSection'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import RecordLinksSection from '@/components/RecordLinksSection'
import AuthGuard from '@/components/AuthGuard'
import CustomFieldsCard from '@/components/CustomFieldsCard'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'
import { getActivityTypes } from '@/lib/activityTypes'
import { RecordColumns, KpiBand, RefCard, MiniItem, Badge, RecordTable, RecordTableEmpty, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream, { type StreamEvent } from '@/components/record/ActivityStream'
import { requireBookRead } from '@/lib/permissions'

const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('contacts')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params

  const [contact, activitiesList, tasksList, expensesList, attachmentsList, customData, canEditFlag, allUsers, activityTypes, changeLogs, accountsList] = await Promise.all([
    db.select({
      id: contacts.id, contact_type: contacts.contact_type, full_name: contacts.full_name, email: contacts.email,
      phone: contacts.phone, title: contacts.title, department: contacts.department,
      birthday: contacts.birthday, description: contacts.description,
      created_at: contacts.created_at, owner_id: contacts.owner_id,
      accounts: { id: accounts.id, name: accounts.name },
    })
      .from(contacts).leftJoin(accounts, eq(contacts.account_id, accounts.id)).where(eq(contacts.id, id)).then((r) => r[0] ?? null),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('contact', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('contact', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('contact', id))).orderBy(desc(expenses.expense_date)),
    db.select().from(attachments).where(eq(attachments.contact_id, id)).orderBy(desc(attachments.created_at)),
    getCustomFieldsWithValues('contacts', id),
    canEdit(),
    getAllUsers(),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'contact'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
  ])

  if (!contact) notFound()

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  const account   = contact.accounts?.id ? contact.accounts : null
  const ownerName = contact.owner_id ? (allUsers.find((u) => u.id === contact.owner_id)?.name ?? null) : null
  const view      = contact.contact_type === 'consumer' ? 'consumer' : 'business'
  const isBiz     = view === 'business'

  async function handleDelete() { 'use server'; await deleteContact(id) }
  async function saveContactInline(formData: FormData) { 'use server'; await updateContact(id, formData) }
  async function toggleTask(formData: FormData) {
    'use server'
    await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/contacts/${id}`)
  }
  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('contact_id', id); formData.set('revalidate', `/contacts/${id}`); await uploadAttachment(formData)
  }
  async function deleteFile(formData: FormData) {
    'use server'
    await deleteAttachment(formData.get('attach_id') as string, formData.get('storage_path') as string, `/contacts/${id}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()
  const openTasks = tasksList.filter((t) => !t.done)
  const overdue = openTasks.filter((t) => t.due_date && new Date(t.due_date).getTime() < NOW).length
  const expSum = expensesList.reduce((s, e) => s + Number(e.amount), 0)

  const kpis: KpiItem[] = [
    { icon: <Activity />, label: '活動', value: <>{activitiesList.length}<small> 件</small></>, sub: activitiesList[0]?.occurred_at ? `最終 ${new Date(activitiesList[0].occurred_at!).toLocaleDateString('ja-JP')}` : '—' },
    { icon: <SquareCheckBig />, label: '未完了ToDo', value: <>{openTasks.length}<small> 件</small></>, sub: overdue ? `期限超過 ${overdue}` : '期限内', subTone: overdue ? 'down' : 'mut' },
    { icon: <Receipt />, label: '経費', value: expSum ? `¥${expSum.toLocaleString()}` : '¥0', sub: `${expensesList.length} 件` },
  ]

  // ── stream ──────────────────────────────────────────────────────
  const dayLabel = (d: Date) => {
    const t0 = new Date(NOW); t0.setHours(0, 0, 0, 0)
    const d0 = new Date(d); d0.setHours(0, 0, 0, 0)
    const diff = Math.round((t0.getTime() - d0.getTime()) / 86400000)
    if (diff === 0) return '今日'; if (diff === 1) return '昨日'
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
  }
  const hm = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const stream: (StreamEvent & { sort: number })[] = []
  for (const a of activitiesList) {
    const d = a.occurred_at ? new Date(a.occurred_at) : a.created_at ? new Date(a.created_at) : null
    if (!d) continue
    stream.push({ id: `a-${a.id}`, kind: 'act', typeLabel: ACTIVITY_TYPE_LABELS[a.type] ?? a.type, time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <><Link href={`/activities/${a.id}`} className="font-semibold text-zinc-900 hover:text-brand-700">{a.subject}</Link>{a.body && <span className="block text-zinc-500 text-[12.5px] mt-0.5 line-clamp-2">{a.body}</span>}</> })
  }
  for (const t of tasksList) {
    const d = t.created_at ? new Date(t.created_at) : null
    if (!d) continue
    const pr = PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.medium
    const overdueT = !t.done && t.due_date && new Date(t.due_date).getTime() < NOW
    stream.push({ id: `t-${t.id}`, kind: 'todo', typeLabel: 'ToDo', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      leading: <AuthGuard minRole="editor"><form action={toggleTask}><input type="hidden" name="task_id" value={t.id} /><input type="hidden" name="done" value={(!t.done).toString()} /><button type="submit" className={`w-4.5 h-4.5 rounded-md border-[1.5px] grid place-items-center ${t.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-zinc-300 hover:border-brand-400'}`}>{t.done && <Check className="w-3 h-3" strokeWidth={3} aria-hidden />}</button></form></AuthGuard>,
      body: <div className="flex items-center gap-2 flex-wrap"><Link href={`/tasks/${t.id}`} className={`font-semibold hover:text-brand-700 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{t.title}</Link><Badge tone={pr.tone}>{pr.label}</Badge>{t.due_date && <span className={`text-[12px] ${overdueT ? 'text-rose-600' : 'text-zinc-400'}`}>期限 {new Date(t.due_date).toLocaleDateString('ja-JP')}</span>}</div> })
  }
  for (const e of expensesList) {
    const d = e.expense_date ? new Date(e.expense_date) : e.created_at ? new Date(e.created_at) : null
    if (!d) continue
    stream.push({ id: `e-${e.id}`, kind: 'exp', typeLabel: '経費', day: dayLabel(d), sort: d.getTime(),
      body: <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-2"><span className="font-semibold text-zinc-900">{e.title}</span><span className="font-bold text-zinc-900 shrink-0">¥{Number(e.amount).toLocaleString()}</span></Link> })
  }
  for (const c of changeLogs) {
    const d = c.changed_at ? new Date(c.changed_at) : null
    if (!d) continue
    stream.push({ id: `c-${c.id}`, kind: 'his', typeLabel: '履歴', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <span className="text-zinc-600">{c.field_label}を <span className="text-zinc-900 font-medium">{c.old_value ?? '—'}</span> → <span className="text-zinc-900 font-medium">{c.new_value ?? '—'}</span> に変更</span> })
  }
  stream.sort((a, b) => b.sort - a.sort)
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer
        relatedToken={`contact:${id}`}
        revalidate={`/contacts/${id}`}
        activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))}
        userInitial={(ownerName ?? contact.full_name).trim()[0]}
        createActivity={quickCreateActivity}
        createTask={quickCreateTask}
        createExpense={quickCreateExpense}
      />
    </AuthGuard>
  )

  const filesTab = (
    <div>
      {attachmentsList.length > 0 ? (
        <RecordTable columns={[{ label: 'ファイル' }, { label: 'サイズ' }, { label: '追加日' }, { label: '' }]}>
          {attachmentsList.map((f) => (
            <tr key={f.id} className="hover:bg-zinc-50">
              <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><a href={`${supabaseUrl}/storage/v1/object/public/attachments/${f.storage_path}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{f.file_name}</a></td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500">{formatFileSize(f.file_size)}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500">{f.created_at ? new Date(f.created_at).toLocaleDateString('ja-JP') : ''}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-right"><AuthGuard minRole="editor"><form action={deleteFile}><input type="hidden" name="attach_id" value={f.id} /><input type="hidden" name="storage_path" value={f.storage_path} /><button type="submit" className="text-xs text-rose-400 hover:text-rose-600">削除</button></form></AuthGuard></td>
            </tr>
          ))}
        </RecordTable>
      ) : <RecordTableEmpty>添付ファイルがありません</RecordTableEmpty>}
      <AuthGuard minRole="editor">
        <form action={uploadFile} className="flex items-center gap-3 px-4 py-3 border-t border-zinc-100">
          <input type="file" name="file" className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200" />
          <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded hover:bg-brand-700 shrink-0">アップロード</button>
        </form>
      </AuthGuard>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '人物', href: `/contacts?view=${view}` }, { label: contact.full_name }]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={contact.full_name}
        badges={<Badge tone={isBiz ? 'info' : 'brand'}>{isBiz ? '法人担当者' : '個人顧客'}</Badge>}
        meta={[
          ...(isBiz && account ? [{ icon: <Building2 className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '取引先', value: account.name }] : []),
          ...(isBiz && [contact.title, contact.department].filter(Boolean).length > 0 ? [{ icon: <Briefcase className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: [contact.title, contact.department].filter(Boolean).join(' / ') }] : []),
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

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard
              title="基本情報"
              dense
              canEdit={canEditFlag}

              action={saveContactInline}
              hiddenFields={[
                { name: 'contact_type', value: contact.contact_type ?? 'business' },
              ]}
              fields={[
                { label: '氏名', name: 'full_name', kind: 'text' as const, value: contact.full_name, view: contact.full_name },
                ...(isBiz ? [{ label: '取引先', name: 'account_id', kind: 'select' as const, value: account?.id ?? '', options: accountsList.map((a) => ({ value: a.id, label: a.name })), view: account ? <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{account.name}</Link> : '—' }] : []),
                ...(isBiz ? [{ label: '役職', name: 'title', kind: 'text' as const, value: contact.title, view: contact.title ?? '—' }] : []),
                ...(isBiz ? [{ label: '部署', name: 'department', kind: 'text' as const, value: contact.department, view: contact.department ?? '—' }] : []),
                { label: '誕生日', name: 'birthday', kind: 'date' as const, value: contact.birthday ? String(contact.birthday).slice(0, 10) : '', view: contact.birthday ? new Date(contact.birthday).toLocaleDateString('ja-JP') : '—' },
                { label: 'メール', name: 'email', kind: 'email' as const, value: contact.email, view: contact.email ? <a href={`mailto:${contact.email}`} className="text-brand-700 hover:underline">{contact.email}</a> : '—' },
                { label: '電話', name: 'phone', kind: 'tel' as const, value: contact.phone, view: contact.phone ?? '—' },
                { label: '担当者', name: 'owner_id', kind: 'select' as const, value: contact.owner_id ?? '', options: allUsers.map((u) => ({ value: u.id, label: u.name })), view: ownerName ?? '—' },
                { label: '登録日', view: contact.created_at ? new Date(contact.created_at).toLocaleDateString('ja-JP') : '—' },
                { label: 'メモ', name: 'description', kind: 'textarea' as const, value: contact.description, fullWidth: true, view: contact.description ? contact.description : <span className="text-zinc-300">—</span> },
              ]}
            />

            {customData.fields.length > 0 && <CustomFieldsCard fields={customData.fields} values={customData.values} />}

            <RefCard title="連絡先" icon={<Contact />}>
              {contact.email && <MiniItem icon={<Mail />} title={<a href={`mailto:${contact.email}`} className="text-brand-700 hover:underline">{contact.email}</a>} sub="メール" />}
              {contact.phone && <MiniItem icon={<Phone />} title={contact.phone} sub="電話" />}
              {account && <MiniItem icon={<Building2 />} iconClass="bg-brand-50 text-brand-700" title={account.name} sub="取引先" href={`/accounts/${account.id}`} />}
              {ownerName && <MiniItem icon={ownerName.trim()[0]} iconClass="bg-brand-600 text-white" title={ownerName} sub="担当" />}
              {!contact.email && !contact.phone && !account && !ownerName && <p className="text-sm text-zinc-400">—</p>}
            </RefCard>

            <RefCard title="タグ" icon={<Tag />}>
              <TagsSection objectType="contact" objectId={id} revalidatePath={`/contacts/${id}`} />
            </RefCard>

            <RecordLinksSection selfApi="contact" selfId={id} />
          </>
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'files', label: '添付', icon: <Folder />, count: attachmentsList.length, content: filesTab },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
