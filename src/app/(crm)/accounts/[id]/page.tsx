import { db } from '@/lib/db'
import { Building2, Factory, UserRound, CalendarDays, Phone, Globe, MapPin, Tag, TrendingUp, Activity, Receipt, SquareCheckBig, ExternalLink, Link2 } from 'lucide-react'
import { accounts, contacts, opportunities, activities, tasks, expenses, attachments, change_logs } from '@/lib/schema'
import { getActivityTypes } from '@/lib/activityTypes'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { updateAccountStatus, deleteAccount, updateAccount, updateAccountContact } from '@/app/actions/accounts'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { toggleTaskDone } from '@/app/actions/tasks'
import TagsSection from '@/components/TagsSection'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import CustomFieldsCard from '@/components/CustomFieldsCard'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import TextImportModal from '@/components/TextImportModal'
import RecordHeader from '@/components/RecordHeader'
import { RecordColumns, KpiBand, RefCard, MiniItem, Badge, RecordTable, RecordTableEmpty, type KpiItem } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream, { type StreamEvent } from '@/components/record/ActivityStream'
import RelatedSegments, { type RelatedSegment } from '@/components/record/RelatedSegments'

const ACCOUNT_TYPES = ['顧客', '見込み客', 'パートナー', '競合他社', 'その他']
const ACCOUNT_INDUSTRIES = [
  'IT・ソフトウェア', '製造業', '商社', '金融・保険', '医療・ヘルスケア',
  '広告・マーケティング', '小売・EC', '食品・飲料', 'エネルギー', '教育', '不動産',
  '弁護士', '司法書士', '税理士', '行政書士', 'その他',
]

const ACCOUNT_STAGES: StageConfig[] = [
  { value: 'prospect', label: '見込み', activeColor: '#2563eb', pastColor: '#93c5fd' },
  { value: 'active',   label: '有効',   activeColor: '#16a34a', pastColor: '#86efac' },
  { value: 'inactive', label: '無効',   activeColor: '#71717a', pastColor: '#d4d4d8' },
]

const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}
const OPEN_STAGES = new Set(['prospecting', 'qualification', 'proposal', 'negotiation'])

const PRIORITY_BADGE: Record<string, { label: string; tone: 'danger' | 'warn' | 'pos' }> = {
  high:   { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'warn' },
  low:    { label: '低', tone: 'pos' },
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [account, contactsList, opportunitiesList, activitiesList, tasksList, expensesList, attachmentsList, customData, editFlag, allUsers, activityTypes, changeLogs] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.id, id)).then((r) => r[0] ?? null),
    db.select().from(contacts).where(eq(contacts.account_id, id)).orderBy(desc(contacts.created_at)),
    db.select().from(opportunities).where(eq(opportunities.account_id, id)).orderBy(desc(opportunities.created_at)),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('account', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('account', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('account', id))).orderBy(desc(expenses.expense_date)),
    db.select().from(attachments).where(eq(attachments.account_id, id)).orderBy(desc(attachments.created_at)),
    getCustomFieldsWithValues('accounts', id),
    canEdit(),
    getAllUsers(),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'account'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
  ])

  if (!account) notFound()

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  // ── server actions ──────────────────────────────────────────────
  async function saveAccountInline(formData: FormData) { 'use server'; await updateAccount(id, formData) }
  async function saveAccountContact(formData: FormData) { 'use server'; await updateAccountContact(id, formData) }
  async function changeStatus(status: string) { 'use server'; await updateAccountStatus(id, status) }
  async function handleDelete() { 'use server'; await deleteAccount(id) }
  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    await toggleTaskDone(taskId, formData.get('done') === 'true', `/accounts/${id}`)
  }
  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('account_id', id); formData.set('revalidate', `/accounts/${id}`); await uploadAttachment(formData)
  }
  async function deleteFile(formData: FormData) {
    'use server'
    await deleteAttachment(formData.get('attach_id') as string, formData.get('storage_path') as string, `/accounts/${id}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ownerName = account.owner_id ? (allUsers.find((u) => u.id === account.owner_id)?.name ?? null) : null

  // ── KPI band ────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()
  const openOpps = opportunitiesList.filter((o) => OPEN_STAGES.has(o.stage))
  const openOppSum = openOpps.reduce((s, o) => s + Number(o.amount ?? 0), 0)
  const openTasks = tasksList.filter((t) => !t.done)
  const overdue = openTasks.filter((t) => t.due_date && new Date(t.due_date).getTime() < NOW).length
  const lastActivity = activitiesList[0]?.occurred_at

  const kpis: KpiItem[] = [
    { icon: <TrendingUp />, label: '進行中商談', value: <>{openOpps.length}<small> 件</small></>, sub: openOppSum ? `想定 ¥${openOppSum.toLocaleString()}` : '—', subTone: 'up' },
    { icon: <UserRound />, label: '人物', value: <>{contactsList.length}<small> 名</small></>, sub: '紐づく連絡先' },
    { icon: <SquareCheckBig />, label: '未完了ToDo', value: <>{openTasks.length}<small> 件</small></>, sub: overdue ? `期限超過 ${overdue}` : '期限内', subTone: overdue ? 'down' : 'mut' },
    { icon: <Activity />, label: '活動', value: <>{activitiesList.length}<small> 件</small></>, sub: lastActivity ? `最終 ${new Date(lastActivity).toLocaleDateString('ja-JP')}` : '—' },
  ]

  // ── activity stream（活動 / ToDo / 経費 / 履歴 を統合）──────────────
  const dayLabel = (d: Date) => {
    const t0 = new Date(NOW); t0.setHours(0, 0, 0, 0)
    const d0 = new Date(d); d0.setHours(0, 0, 0, 0)
    const diff = Math.round((t0.getTime() - d0.getTime()) / 86400000)
    if (diff === 0) return '今日'
    if (diff === 1) return '昨日'
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
  }
  const hm = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  const stream: (StreamEvent & { sort: number })[] = []
  for (const a of activitiesList) {
    const d = a.occurred_at ? new Date(a.occurred_at) : a.created_at ? new Date(a.created_at) : null
    if (!d) continue
    stream.push({
      id: `a-${a.id}`, kind: 'act', typeLabel: ACTIVITY_TYPE_LABELS[a.type] ?? a.type, time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <><Link href={`/activities/${a.id}`} className="font-semibold text-zinc-900 hover:text-brand-700">{a.subject}</Link>{a.body && <span className="block text-zinc-500 text-[12.5px] mt-0.5 line-clamp-2">{a.body}</span>}</>,
    })
  }
  for (const t of tasksList) {
    const d = t.created_at ? new Date(t.created_at) : null
    if (!d) continue
    const pr = PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.medium
    const overdueT = !t.done && t.due_date && new Date(t.due_date).getTime() < NOW
    stream.push({
      id: `t-${t.id}`, kind: 'todo', typeLabel: 'ToDo', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      leading: (
        <AuthGuard minRole="editor">
          <form action={toggleTask}>
            <input type="hidden" name="task_id" value={t.id} />
            <input type="hidden" name="done" value={(!t.done).toString()} />
            <button type="submit" className={`w-4.5 h-4.5 rounded-md border-[1.5px] grid place-items-center ${t.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-zinc-300 hover:border-brand-400'}`}>{t.done && <span className="text-[10px] leading-none">✓</span>}</button>
          </form>
        </AuthGuard>
      ),
      body: <div className="flex items-center gap-2 flex-wrap"><Link href={`/tasks/${t.id}`} className={`font-semibold hover:text-brand-700 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{t.title}</Link><Badge tone={pr.tone}>{pr.label}</Badge>{t.due_date && <span className={`text-[12px] ${overdueT ? 'text-rose-600' : 'text-zinc-400'}`}>期限 {new Date(t.due_date).toLocaleDateString('ja-JP')}</span>}</div>,
    })
  }
  for (const e of expensesList) {
    const d = e.expense_date ? new Date(e.expense_date) : e.created_at ? new Date(e.created_at) : null
    if (!d) continue
    stream.push({
      id: `e-${e.id}`, kind: 'exp', typeLabel: '経費', day: dayLabel(d), sort: d.getTime(),
      body: <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-2"><span className="font-semibold text-zinc-900">{e.title}</span><span className="font-bold text-zinc-900 shrink-0">¥{Number(e.amount).toLocaleString()}</span></Link>,
    })
  }
  for (const c of changeLogs) {
    const d = c.changed_at ? new Date(c.changed_at) : null
    if (!d) continue
    stream.push({
      id: `c-${c.id}`, kind: 'his', typeLabel: '履歴', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <span className="text-zinc-600">{c.field_label}を <span className="text-zinc-900 font-medium">{c.old_value ?? '—'}</span> → <span className="text-zinc-900 font-medium">{c.new_value ?? '—'}</span> に変更</span>,
    })
  }
  stream.sort((a, b) => b.sort - a.sort)
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length

  // ── composer ────────────────────────────────────────────────────
  const composer = (
    <AuthGuard minRole="editor">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50">
        <span className="w-7 h-7 rounded-full bg-brand-600 text-white grid place-items-center text-xs font-bold shrink-0">{(ownerName ?? account.name).trim()[0]}</span>
        <Link href={`/activities/new?account_id=${id}`} className="flex-1 h-9 border border-zinc-300 rounded-md bg-white flex items-center px-3 text-sm text-zinc-400 hover:border-zinc-400 transition-colors min-w-0">活動・メモを記録…</Link>
        <div className="flex gap-1 shrink-0">
          <Link href={`/activities/new?account_id=${id}`} title="活動" className="w-8 h-8 rounded-md border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-brand-50 hover:text-brand-700"><Phone className="w-4 h-4" /></Link>
          <Link href={`/tasks/new?account_id=${id}`} title="ToDo" className="w-8 h-8 rounded-md border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-brand-50 hover:text-brand-700"><SquareCheckBig className="w-4 h-4" /></Link>
          <Link href={`/expenses/new?account_id=${id}`} title="経費" className="w-8 h-8 rounded-md border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-brand-50 hover:text-brand-700"><Receipt className="w-4 h-4" /></Link>
        </div>
      </div>
    </AuthGuard>
  )

  // ── related segments ────────────────────────────────────────────
  const segments: RelatedSegment[] = [
    {
      id: 'contacts', label: '人物', icon: <UserRound />, count: contactsList.length,
      content: (
        <>
          <div className="flex items-center justify-end gap-2 px-4 py-2">
            <AuthGuard minRole="editor"><TextImportModal importUrl="/api/import/contacts" title="人物インポート" csvFormat="ID,氏名,役職,部署,メール,電話番号,誕生日,メモ" defaultContext={{ account_id: id }} /></AuthGuard>
            <AuthGuard minRole="editor"><Link href={`/contacts/new?account_id=${id}`} className="text-xs text-brand-700 font-semibold hover:text-brand-800">＋ 追加</Link></AuthGuard>
          </div>
          {contactsList.length === 0 ? <RecordTableEmpty>人物がいません</RecordTableEmpty> : (
            <RecordTable columns={[{ label: '氏名' }, { label: '役職・部署' }, { label: 'メール' }, { label: '電話' }]}>
              {contactsList.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><Link href={`/contacts/${c.id}`} className="hover:text-brand-700">{c.full_name}</Link></td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600">{[c.title, c.department].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </RecordTable>
          )}
        </>
      ),
    },
    {
      id: 'opps', label: '商談', icon: <TrendingUp />, count: opportunitiesList.length,
      content: (
        <>
          <div className="flex items-center justify-end gap-2 px-4 py-2">
            <AuthGuard minRole="editor"><Link href={`/opportunities/new?account_id=${id}`} className="text-xs text-brand-700 font-semibold hover:text-brand-800">＋ 追加</Link></AuthGuard>
          </div>
          {opportunitiesList.length === 0 ? <RecordTableEmpty>商談がありません</RecordTableEmpty> : (
            <RecordTable columns={[{ label: '商談名' }, { label: 'ステージ' }, { label: '金額', num: true }, { label: '確度', num: true }, { label: '完了予定' }]}>
              {opportunitiesList.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><Link href={`/opportunities/${o.id}`} className="hover:text-brand-700">{o.name}</Link></td>
                  <td className="px-4 py-2.5 border-b border-zinc-100"><Badge tone={o.stage === 'closed_won' ? 'pos' : o.stage === 'closed_lost' ? 'neutral' : o.stage === 'negotiation' ? 'warn' : 'info'} dot>{OPPORTUNITY_STAGE_LABELS[o.stage] ?? o.stage}</Badge></td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-700">{o.amount ? `¥${Number(o.amount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-600">{o.probability != null ? `${o.probability}%` : '—'}</td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-600">{o.close_date ?? '—'}</td>
                </tr>
              ))}
            </RecordTable>
          )}
        </>
      ),
    },
    {
      id: 'files', label: '添付', count: attachmentsList.length,
      content: (
        <div>
          {attachmentsList.length > 0 && (
            <RecordTable columns={[{ label: 'ファイル' }, { label: 'サイズ' }, { label: '追加日' }, { label: '' }]}>
              {attachmentsList.map((f) => (
                <tr key={f.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><a href={`${supabaseUrl}/storage/v1/object/public/attachments/${f.storage_path}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{f.file_name}</a></td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500">{formatFileSize(f.file_size)}</td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500">{f.created_at ? new Date(f.created_at).toLocaleDateString('ja-JP') : ''}</td>
                  <td className="px-4 py-2.5 border-b border-zinc-100 text-right">
                    <AuthGuard minRole="editor"><form action={deleteFile}><input type="hidden" name="attach_id" value={f.id} /><input type="hidden" name="storage_path" value={f.storage_path} /><button type="submit" className="text-xs text-rose-400 hover:text-rose-600">削除</button></form></AuthGuard>
                  </td>
                </tr>
              ))}
            </RecordTable>
          )}
          <AuthGuard minRole="editor">
            <form action={uploadFile} className="flex items-center gap-3 px-4 py-3 border-t border-zinc-100">
              <input type="file" name="file" className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200" />
              <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded hover:bg-brand-700 shrink-0">アップロード</button>
            </form>
          </AuthGuard>
        </div>
      ),
    },
  ]

  const industryLabel = [account.type, account.industry].filter(Boolean).join(' / ') || null
  const statusBadge = ({
    prospect: { label: '見込み', tone: 'info' as const },
    active:   { label: '顧客',   tone: 'brand' as const },
    inactive: { label: '無効',   tone: 'neutral' as const },
  } as Record<string, { label: string; tone: 'info' | 'brand' | 'neutral' }>)[account.status] ?? null

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '取引先', href: '/accounts' }, { label: account.name }]}
        avatar={<Building2 className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={account.name}
        badges={statusBadge && <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>}
        meta={[
          ...(industryLabel ? [{ icon: <Factory className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '業種', value: industryLabel }] : []),
          ...(ownerName ? [{ icon: <UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '担当', value: ownerName }] : []),
          ...(account.created_at ? [{ icon: <CalendarDays className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '登録', value: new Date(account.created_at).toLocaleDateString('ja-JP') }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton />
              <DeleteButton action={handleDelete} confirmMessage="この取引先を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5 max-w-xs">
        <StageBar stages={ACCOUNT_STAGES} currentStage={account.status} updateAction={changeStatus} />
      </div>

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard
              title="基本情報"
              dense
              canEdit={editFlag}
              showEditButton={false}
              action={saveAccountInline}
              hiddenFields={[
                { name: 'name', value: account.name },
                { name: 'status', value: account.status ?? 'active' },
                { name: 'phone', value: account.phone ?? '' },
                { name: 'website', value: account.website ?? '' },
                { name: 'address', value: account.address ?? '' },
                { name: 'owner_id', value: account.owner_id ?? '' },
              ]}
              fields={[
                { label: '従業員数', name: 'employee_count', kind: 'number', value: account.employee_count != null ? String(account.employee_count) : '', view: account.employee_count ? `${account.employee_count.toLocaleString()} 名` : '—' },
                { label: '年間売上', name: 'annual_revenue', kind: 'number', value: account.annual_revenue != null ? String(account.annual_revenue) : '', view: account.annual_revenue ? `¥${Number(account.annual_revenue).toLocaleString()}` : '—' },
                { label: '業種', name: 'industry', kind: 'select', value: account.industry, options: ACCOUNT_INDUSTRIES.map((i) => ({ value: i, label: i })), view: account.industry ?? '—' },
                { label: '種別', name: 'type', kind: 'select', value: account.type, options: ACCOUNT_TYPES.map((t) => ({ value: t, label: t })), view: account.type ?? '—' },
                { label: '概要・メモ', name: 'description', kind: 'textarea', value: account.description, fullWidth: true, view: account.description ? account.description : <span className="text-zinc-300">—</span> },
              ]}
            />

            <EditableInfoCard
              title="連絡先"
              dense
              canEdit={editFlag}
              editEvent="bract:edit-account-contact"
              action={saveAccountContact}
              fields={[
                { label: '電話', name: 'phone', kind: 'tel', value: account.phone, view: account.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2.25} />{account.phone}</span> : '—' },
                { label: 'Web', name: 'website', kind: 'text', value: account.website, view: account.website ? <span className="inline-flex items-center gap-1.5 min-w-0"><Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2.25} /><a href={account.website} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline truncate">{account.website}</a></span> : '—' },
                { label: '住所', name: 'address', kind: 'text', value: account.address, fullWidth: true, view: account.address ? <span className="inline-flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" strokeWidth={2.25} />{account.address}</span> : '—' },
              ]}
            />

            {customData.fields.length > 0 && <CustomFieldsCard fields={customData.fields} values={customData.values} />}

            <RefCard title="担当・連絡先" icon={<UserRound />}>
              {ownerName && <MiniItem icon={ownerName.trim()[0]} iconClass="bg-brand-600 text-white" title={ownerName} sub="担当" />}
              {contactsList.slice(0, 3).map((c) => (
                <MiniItem key={c.id} icon={<UserRound />} title={c.full_name} sub={[c.title, c.department].filter(Boolean).join(' / ') || '人物'} href={`/contacts/${c.id}`} right={<ExternalLink className="w-3.5 h-3.5" />} />
              ))}
              {!ownerName && contactsList.length === 0 && <p className="text-sm text-zinc-400">—</p>}
            </RefCard>

            <RefCard title="タグ" icon={<Tag />}>
              <TagsSection objectType="account" objectId={id} revalidatePath={`/accounts/${id}`} />
            </RefCard>
          </>
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'related', label: '関連情報', icon: <Link2 />, count: contactsList.length + opportunitiesList.length + attachmentsList.length, content: <RelatedSegments segments={segments} /> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
