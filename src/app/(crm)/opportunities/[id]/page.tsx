import { db } from '@/lib/db'
import { Briefcase, Building2, Wallet, CalendarDays, UserRound, Tag, Activity, Link2, TrendingUp, Folder } from 'lucide-react'
import { opportunities, accounts, contacts, activities, tasks, attachments, expenses, change_logs, opportunity_products } from '@/lib/schema'
import { getProductPickerOptions } from '@/lib/opportunityProductBooks'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { deleteOpportunity, updateOpportunityBasic } from '@/app/actions/opportunities'
import { requestStatusChange } from '@/app/actions/approvals'
import ApprovalSection from '@/components/approvals/ApprovalSection'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import InlineComposer from '@/components/record/InlineComposer'
import TagsSection from '@/components/TagsSection'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import CustomFieldsCard from '@/components/CustomFieldsCard'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit, isAdmin } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import AISummaryButton from '@/components/AISummaryButton'
import ReportButton from '@/components/ReportButton'
import { NavIcon } from '@/lib/navIcon'
import { summarizeOpportunity } from '@/app/actions/ai'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import { calcProfit, commissionBreakdown, effectiveCommissionRatePct, effectiveCommissionMonths } from '@/industries/real-estate/lib/realEstateCommission'
import { calcAutoBodyProfit } from '@/industries/auto-body/lib/autoBodyService'
import { vehicles } from '@/lib/schema'
import { activeIndustry } from '@/lib/industry'
import { getActivityTypes } from '@/lib/activityTypes'
import { RecordColumns, KpiBand, RefCard, MiniItem, Badge, RecordTable, RecordTableEmpty, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream, { type StreamEvent } from '@/components/record/ActivityStream'
import RelatedSegments, { type RelatedSegment } from '@/components/record/RelatedSegments'
import OpportunityProductsEditor, { type ProductOption } from '@/components/opportunity/OpportunityProductsEditor'
import { requireBookRead } from '@/lib/permissions'

const OPPORTUNITY_STAGES: StageConfig[] = [
  { value: 'prospecting',   label: '見込み',   activeColor: '#71717a', pastColor: '#d4d4d8' },
  { value: 'qualification', label: '要件確認', activeColor: '#2563eb', pastColor: '#93c5fd' },
  { value: 'proposal',      label: '提案',     activeColor: '#d97706', pastColor: '#fcd34d' },
  { value: 'negotiation',   label: '交渉',     activeColor: '#ea580c', pastColor: '#fdba74' },
  { value: 'closed_won',    label: '受注',     activeColor: '#16a34a', pastColor: '#86efac' },
  { value: 'closed_lost',   label: '失注',     activeColor: '#dc2626', pastColor: '#fca5a5' },
]
const STAGE_LABEL: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}
const STAGE_TONE: Record<string, BadgeTone> = {
  prospecting: 'neutral', qualification: 'info', proposal: 'ai', negotiation: 'warn', closed_won: 'pos', closed_lost: 'danger',
}
const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('opportunities')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params

  const [opportunity, activitiesList, tasksList, attachmentsList, expensesList, customData, editFlag, allUsers, activityTypes, changeLogs] = await Promise.all([
    db.select({
      id: opportunities.id, name: opportunities.name, stage: opportunities.stage,
      amount: opportunities.amount, probability: opportunities.probability,
      close_date: opportunities.close_date, description: opportunities.description,
      created_at: opportunities.created_at, owner_id: opportunities.owner_id,
      transaction_type: opportunities.transaction_type, commission_fee: opportunities.commission_fee,
      brokerage_type: opportunities.brokerage_type, other_profit: opportunities.other_profit,
      service_type: opportunities.service_type, vehicle_id: opportunities.vehicle_id, parts_cost: opportunities.parts_cost,
      accounts: { id: accounts.id, name: accounts.name },
      contacts: { id: contacts.id, full_name: contacts.full_name },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .leftJoin(contacts, eq(opportunities.contact_id, contacts.id))
      .where(eq(opportunities.id, id)).then((r) => r[0] ?? null),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('opportunity', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('opportunity', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(attachments).where(eq(attachments.opportunity_id, id)).orderBy(desc(attachments.created_at)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('opportunity', id))).orderBy(desc(expenses.expense_date)),
    getCustomFieldsWithValues('opportunities', id),
    canEdit(),
    getAllUsers(),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'opportunity'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
  ])

  if (!opportunity) notFound()

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  const account   = opportunity.accounts?.id ? opportunity.accounts : null
  const contact   = opportunity.contacts?.id ? opportunity.contacts : null
  const ownerName = opportunity.owner_id ? (allUsers.find((u) => u.id === opportunity.owner_id)?.name ?? null) : null

  const vehicleInfo = activeIndustry === 'auto-body' && opportunity.vehicle_id
    ? await db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate, year: vehicles.year })
        .from(vehicles).where(eq(vehicles.id, opportunity.vehicle_id)).then((r) => r[0] ?? null)
    : null

  // ── 商品明細（#5）＋ 紐付け候補（設定されたブックから構築。REQ-0034）──
  const [productLines, productOptions] = await Promise.all([
    db.select().from(opportunity_products).where(eq(opportunity_products.opportunity_id, id)).orderBy(asc(opportunity_products.sort_order), asc(opportunity_products.created_at)),
    getProductPickerOptions() as Promise<ProductOption[]>,
  ])
  const productLinesForUi = productLines.map((l) => ({
    id: l.id, product_object_api: l.product_object_api, product_record_id: l.product_record_id,
    name: l.name, quantity: l.quantity, unit_price: l.unit_price, note: l.note,
  }))

  async function saveOppBasic(formData: FormData) { 'use server'; await updateOpportunityBasic(id, formData) }
  async function changeStage(stage: string) { 'use server'; return await requestStatusChange('opportunities', id, 'stage', stage) }
  async function handleDelete() { 'use server'; await deleteOpportunity(id) }
  async function toggleTask(formData: FormData) {
    'use server'
    await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/opportunities/${id}`)
  }
  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('opportunity_id', id); formData.set('revalidate', `/opportunities/${id}`); await uploadAttachment(formData)
  }
  async function deleteFile(formData: FormData) {
    'use server'
    await deleteAttachment(formData.get('attach_id') as string, formData.get('storage_path') as string, `/opportunities/${id}`)
  }
  async function handleSummarize(from: string, to: string) { 'use server'; return summarizeOpportunity(id, from, to) }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()

  // ── 財務計算（KPI とカードで共有）────────────────────────────────
  const isReal = activeIndustry === 'real-estate'
  const isAutoBody = activeIndustry === 'auto-body'
  const totalExp = expensesList.reduce((s, e) => s + Number(e.amount), 0)
  const prob = opportunity.probability != null ? opportunity.probability / 100 : null
  let weighted: number | null = null
  let gross: number | null = null
  if (isReal) {
    const fee = opportunity.commission_fee != null ? Number(opportunity.commission_fee) : null
    const oth = opportunity.other_profit != null ? Number(opportunity.other_profit) : 0
    const profit = fee != null ? calcProfit(fee, opportunity.brokerage_type, oth) : 0
    weighted = prob != null && fee != null ? Math.round(profit * prob) : (fee != null ? profit : null)
  } else if (isAutoBody) {
    const amt = opportunity.amount != null ? Number(opportunity.amount) : null
    const pc = opportunity.parts_cost != null ? Number(opportunity.parts_cost) : 0
    const profit = amt != null ? calcAutoBodyProfit(amt, pc) : 0
    weighted = prob != null && amt != null ? Math.round(profit * prob) : (amt != null ? profit : null)
  } else {
    const amount = Number(opportunity.amount ?? 0)
    weighted = prob != null && amount > 0 ? Math.round(amount * prob) : (amount > 0 ? amount : null)
  }
  gross = weighted != null ? weighted - totalExp : null
  const daysLeft = opportunity.close_date ? Math.ceil((new Date(opportunity.close_date).getTime() - NOW) / 86400000) : null

  const kpis: KpiItem[] = [
    { icon: <Wallet />, label: '金額', value: opportunity.amount ? `¥${Number(opportunity.amount).toLocaleString()}` : '—', sub: opportunity.transaction_type === '賃貸' ? '月額' : '税抜' },
    { icon: <Activity />, label: '確度 / 加重', value: opportunity.probability != null ? <>{opportunity.probability}<small>%</small></> : '—', sub: weighted != null ? `加重 ¥${weighted.toLocaleString()}` : '—', subTone: 'up' },
    { icon: <CalendarDays />, label: '完了予定', value: <span className="text-[17px]">{opportunity.close_date ?? '—'}</span>, sub: daysLeft != null ? (daysLeft < 0 ? `${-daysLeft}日超過` : `残 ${daysLeft}日`) : '—', subTone: daysLeft != null && daysLeft < 0 ? 'down' : 'warn' },
    { icon: <TrendingUp />, label: '想定粗利', value: gross != null ? `¥${gross.toLocaleString()}` : '—', sub: `経費 ¥${totalExp.toLocaleString()}`, subTone: gross != null && gross < 0 ? 'down' : 'mut' },
  ]

  // ── activity stream ─────────────────────────────────────────────
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
      leading: <AuthGuard minRole="editor"><form action={toggleTask}><input type="hidden" name="task_id" value={t.id} /><input type="hidden" name="done" value={(!t.done).toString()} /><button type="submit" className={`w-4.5 h-4.5 rounded-md border-[1.5px] grid place-items-center ${t.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-zinc-300 hover:border-brand-400'}`}>{t.done && <span className="text-[10px] leading-none">✓</span>}</button></form></AuthGuard>,
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
  const aiEnabled = await isAIFeatureEnabled()
  const isAdminUser = await isAdmin()

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer
        relatedToken={`opportunity:${id}`}
        revalidate={`/opportunities/${id}`}
        activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))}
        userInitial={(ownerName ?? opportunity.name).trim()[0]}
        createActivity={quickCreateActivity}
        createTask={quickCreateTask}
        createExpense={quickCreateExpense}
      />
    </AuthGuard>
  )

  // ── 不動産情報 / 自動車整備情報（左カラムカード）────────────────
  const realEstateCard = isReal && (() => {
    const tx = opportunity.transaction_type === '賃貸' ? '賃貸' : '売買'
    const isRent = tx === '賃貸'
    const price = opportunity.amount != null ? Number(opportunity.amount) : null
    const fee = opportunity.commission_fee != null ? Number(opportunity.commission_fee) : null
    const oth = opportunity.other_profit != null ? Number(opportunity.other_profit) : 0
    const bk = opportunity.brokerage_type ?? null
    if (!(fee != null || bk != null || oth > 0)) return null
    const profit = calcProfit(fee, bk, oth)
    const breakdown = commissionBreakdown(price, tx)
    const effRate = !isRent ? effectiveCommissionRatePct(price, fee) : null
    const effMonths = isRent ? effectiveCommissionMonths(price, fee) : null
    return (
      <RefCard title="不動産情報" icon={<NavIcon icon="🏠" className="w-4 h-4" />}>
        <dl className="space-y-2 text-[13px]">
          <Row label="取引区分" value={tx} />
          <Row label="仲介種別" value={bk ?? '—'} />
          <Row label="仲介手数料" value={<>{fee != null ? `¥${Math.round(fee).toLocaleString('ja-JP')}` : '—'}{(breakdown || effRate != null || effMonths != null) && <span className="block text-[11px] text-zinc-400 mt-0.5">{breakdown}{breakdown && (effRate != null || effMonths != null) && ' ・ '}{effRate != null && `実効率 ${effRate.toFixed(2)}%`}{effMonths != null && `${effMonths.toFixed(2)}ヶ月分`}</span>}</>} />
          <Row label="その他利益" value={`¥${Math.round(oth).toLocaleString('ja-JP')}`} />
        </dl>
        <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-between items-baseline">
          <span className="text-[13px] font-semibold text-zinc-700">利益（自動計算）</span>
          <span className={`text-lg font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>¥{Math.round(profit).toLocaleString('ja-JP')}</span>
        </div>
      </RefCard>
    )
  })()

  const autoBodyCard = isAutoBody && (() => {
    const st = opportunity.service_type
    const amt = opportunity.amount != null ? Number(opportunity.amount) : 0
    const pc = opportunity.parts_cost != null ? Number(opportunity.parts_cost) : 0
    const profit = calcAutoBodyProfit(amt, pc)
    if (!(st || vehicleInfo || pc > 0)) return null
    return (
      <RefCard title="自動車整備情報" icon={<NavIcon icon="🔧" className="w-4 h-4" />}>
        <dl className="space-y-2 text-[13px]">
          <Row label="サービス区分" value={st ?? '—'} />
          <Row label="対象車両" value={vehicleInfo ? <Link href={`/vehicles/${vehicleInfo.id}`} className="text-brand-700 hover:underline inline-flex items-center gap-1"><NavIcon icon="🚗" className="w-3.5 h-3.5 shrink-0" /> {vehicleInfo.maker} {vehicleInfo.model}{vehicleInfo.license_plate && <span className="text-xs text-zinc-400 ml-1">{vehicleInfo.license_plate}</span>}</Link> : '—'} />
          <Row label="売上（金額）" value={amt > 0 ? `¥${amt.toLocaleString()}` : '—'} />
          <Row label="部品仕入原価" value={`¥${pc.toLocaleString()}`} />
        </dl>
        <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-between items-baseline">
          <span className="text-[13px] font-semibold text-zinc-700">利益（自動計算）</span>
          <span className={`text-lg font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>¥{profit.toLocaleString()}</span>
        </div>
      </RefCard>
    )
  })()

  const segments: RelatedSegment[] = [
    {
      id: 'files', label: '添付', count: attachmentsList.length,
      content: (
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
      ),
    },
    {
      id: 'links', label: '関連レコード', icon: <Link2 />,
      content: <div className="px-4 py-3"><RelatedRecordsSection objectType="opportunities" recordId={id} pagePath={`/opportunities/${id}`} /></div>,
    },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '商談', href: '/opportunities' }, { label: opportunity.name }]}
        avatar={<Briefcase className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={opportunity.name}
        badges={<Badge tone={STAGE_TONE[opportunity.stage] ?? 'neutral'} dot>{STAGE_LABEL[opportunity.stage] ?? opportunity.stage}</Badge>}
        meta={[
          ...(account ? [{ icon: <Building2 className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{account.name}</Link> }] : []),
          ...(ownerName ? [{ icon: <UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '担当', value: ownerName }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              {aiEnabled && <ReportButton targetApi="opportunity" recordId={id} targetLabel="商談" isAdmin={isAdminUser} />}
              {aiEnabled && <AISummaryButton label="AIで活動をまとめる" action={handleSummarize} />}
              <InlineEditButton />
              <DeleteButton action={handleDelete} confirmMessage="この商談を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5">
        <StageBar stages={OPPORTUNITY_STAGES} currentStage={opportunity.stage} updateAction={changeStage} />
      </div>

      <ApprovalSection objectType="opportunities" objectId={id} />

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard
              title="商談情報"
              dense
              canEdit={editFlag}

              action={saveOppBasic}
              fields={[
                { label: 'ステージ', view: STAGE_LABEL[opportunity.stage] ?? opportunity.stage },
                { label: '完了予定', name: 'close_date', kind: 'date', value: opportunity.close_date ? String(opportunity.close_date).slice(0, 10) : '', view: opportunity.close_date ?? '—' },
                { label: isReal && opportunity.transaction_type === '賃貸' ? '月額賃料' : '金額', name: 'amount', kind: 'number', value: opportunity.amount != null ? String(opportunity.amount) : '', view: opportunity.amount ? `¥${Number(opportunity.amount).toLocaleString()}` : '—' },
                { label: '確度', name: 'probability', kind: 'number', value: opportunity.probability != null ? String(opportunity.probability) : '', view: opportunity.probability != null ? `${opportunity.probability}%` : '—' },
                { label: '担当者', name: 'owner_id', kind: 'select', value: opportunity.owner_id ?? '', options: allUsers.map((u) => ({ value: u.id, label: u.name })), view: ownerName ?? '—' },
                { label: '登録日', view: opportunity.created_at ? new Date(opportunity.created_at).toLocaleDateString('ja-JP') : '—' },
                { label: '概要・メモ', name: 'description', kind: 'textarea', value: opportunity.description, fullWidth: true, view: opportunity.description ? opportunity.description : <span className="text-zinc-300">—</span> },
              ]}
            />

            {realEstateCard}
            {autoBodyCard}

            {customData.fields.length > 0 && <CustomFieldsCard fields={customData.fields} values={customData.values} />}

            <RefCard title="取引先・連絡先" icon={<Building2 />}>
              {account && <MiniItem icon={<Building2 />} iconClass="bg-brand-50 text-brand-700" title={account.name} sub="取引先" href={`/accounts/${account.id}`} right={<NavIcon icon="↗" className="w-3.5 h-3.5" />} />}
              {contact && <MiniItem icon={<UserRound />} title={contact.full_name} sub="人物" href={`/contacts/${contact.id}`} />}
              {ownerName && <MiniItem icon={ownerName.trim()[0]} iconClass="bg-brand-600 text-white" title={ownerName} sub="担当" />}
              {!account && !contact && !ownerName && <p className="text-sm text-zinc-400">—</p>}
            </RefCard>

            <RefCard title="タグ" icon={<Tag />}>
              <TagsSection objectType="opportunity" objectId={id} revalidatePath={`/opportunities/${id}`} />
            </RefCard>
          </>
        }
      >
        {/* 商品セクション（#5） */}
        <section className="bg-white border border-zinc-200 rounded-lg shadow-xs mb-4">
          <div className="px-4 py-2.5 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5"><NavIcon icon="📦" className="w-4 h-4" /><span>商品</span></h2>
          </div>
          <div className="p-4">
            <OpportunityProductsEditor opportunityId={id} lines={productLinesForUi} productOptions={productOptions} canEdit={editFlag} />
          </div>
        </section>

        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'related', label: '関連情報', icon: <Folder />, count: attachmentsList.length, content: <RelatedSegments segments={segments} /> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-900 text-right min-w-0">{value}</dd>
    </div>
  )
}
