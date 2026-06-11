import { buildRecordStream } from '@/lib/buildRecordStream'
import { db } from '@/lib/db'
import { House, Building2, UserRound, Tag, Wallet, Activity, SquareCheckBig, Receipt, Folder } from 'lucide-react'
import { accounts, contacts, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, inArray, desc, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteProperty, updatePropertyBasic } from '@/industries/real-estate/actions/properties'
import { canEdit } from '@/lib/auth'
import EditableInfoCard, { type EditField } from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import StageBar from '@/components/StageBar'
import { PROPERTY_STAGES } from '@/lib/statusStages'
import { requestStatusChange } from '@/app/actions/approvals'
import ApprovalSection from '@/components/approvals/ApprovalSection'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import DeleteButton from '@/components/DeleteButton'
import TagsSection from '@/components/TagsSection'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import { getActivityTypes } from '@/lib/activityTypes'
import AISummaryButton from '@/components/AISummaryButton'
import { summarizeProperty } from '@/app/actions/ai'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import { NavIcon } from '@/lib/navIcon'
import { RecordColumns, KpiBand, RefCard, MiniItem, Badge, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'

const RE_PROPERTY_TYPES = ['土地・建物', '建物のみ', '土地のみ', 'その他']
const RE_TX_TYPES = ['売買', '賃貸']
const OTHER_TX_TYPES = ['売買', '賃貸', 'サービス提供', 'その他']
const TX_TONE: Record<string, BadgeTone> = { '売買': 'warn', '賃貸': 'info' }

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [row, activitiesList, tasksList, expensesList, activityTypes, changeLogs, accountsAll, contactsAll] = await Promise.all([
    db.select().from(properties).leftJoin(accounts, eq(properties.account_id, accounts.id)).leftJoin(contacts, eq(properties.contact_id, contacts.id)).where(eq(properties.id, id)).then((r) => r[0] ?? null),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('properties', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('properties', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('properties', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'property'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name }).from(contacts).orderBy(asc(contacts.full_name)),
  ])

  if (!row) notFound()

  const p = row.properties
  const account = row.accounts?.id ? row.accounts : null
  const contact = row.contacts?.id ? row.contacts : null
  const isRE = p.product_category !== 'other'
  const editFlag = await canEdit()
  const viewParam = isRE ? 'real_estate' : 'other'

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  let sellerScrivenerAccount: { id: string; name: string } | null = null
  let sellerScrivenerContact: { id: string; full_name: string } | null = null
  let buyerScrivenerAccount: { id: string; name: string } | null = null
  let buyerScrivenerContact: { id: string; full_name: string } | null = null
  if (isRE) {
    const accountIds = [p.seller_scrivener_account_id, p.buyer_scrivener_account_id].filter(Boolean) as string[]
    const contactIds = [p.seller_scrivener_contact_id, p.buyer_scrivener_contact_id].filter(Boolean) as string[]
    const [scrAccounts, scrContacts] = await Promise.all([
      accountIds.length > 0 ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds)) : Promise.resolve([]),
      contactIds.length > 0 ? db.select({ id: contacts.id, full_name: contacts.full_name }).from(contacts).where(inArray(contacts.id, contactIds)) : Promise.resolve([]),
    ])
    const accMap = new Map(scrAccounts.map((a) => [a.id, a]))
    const conMap = new Map(scrContacts.map((c) => [c.id, c]))
    if (p.seller_scrivener_account_id) sellerScrivenerAccount = accMap.get(p.seller_scrivener_account_id) ?? null
    if (p.seller_scrivener_contact_id) sellerScrivenerContact = conMap.get(p.seller_scrivener_contact_id) ?? null
    if (p.buyer_scrivener_account_id) buyerScrivenerAccount = accMap.get(p.buyer_scrivener_account_id) ?? null
    if (p.buyer_scrivener_contact_id) buyerScrivenerContact = conMap.get(p.buyer_scrivener_contact_id) ?? null
  }

  async function savePropertyInline(formData: FormData) { 'use server'; await updatePropertyBasic(id, formData) }
  async function handleDelete() { 'use server'; await deleteProperty(id) }
  async function changeStatus(status: string) { 'use server'; return await requestStatusChange('properties', id, 'status', status) }
  async function toggleTask(formData: FormData) { 'use server'; await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/properties/${id}`) }
  async function handlePropertySummarize(from: string, to: string) { 'use server'; return summarizeProperty(id, from, to) }

  const fmt = {
    price: (v: string | null) => v ? `¥${Number(v).toLocaleString()}` : null,
    area: (v: string | null) => v ? `${Number(v).toLocaleString()} ㎡` : null,
    debt: (v: number | null) => v ? `¥${v.toLocaleString()}` : null,
    rate: (v: string | null) => v ? `${Number(v)}%` : null,
    bool: (v: boolean | null) => v === true ? '✓ あり' : v === false ? 'なし' : null,
    date: (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP') : null,
  }
  const accountOptions = accountsAll.map((a) => ({ value: a.id, label: a.name }))
  const contactOptions = contactsAll.map((c) => ({ value: c.id, label: c.full_name }))

  const propertyFields: EditField[] = isRE ? [
    { section: '基本情報', label: '物件種別', name: 'property_type', kind: 'select', value: p.property_type, options: RE_PROPERTY_TYPES.map((t) => ({ value: t, label: t })), view: p.property_type ?? '—' },
    { section: '基本情報', label: '取引種別', name: 'transaction_type', kind: 'select', value: p.transaction_type, options: RE_TX_TYPES.map((t) => ({ value: t, label: t })), view: p.transaction_type ?? '—' },
    { section: '基本情報', label: '価格 / 賃料', name: 'price', kind: 'number', value: p.price != null ? String(p.price) : '', view: fmt.price(p.price) ?? '—' },
    { section: '基本情報', label: '登録日', view: p.created_at ? new Date(p.created_at).toLocaleDateString('ja-JP') : '—' },
    { section: '土地の登記（表題部）', label: '不動産番号', name: 'land_fudosan_number', kind: 'text', value: p.land_fudosan_number, view: p.land_fudosan_number ?? '—' },
    { section: '土地の登記（表題部）', label: '所在', name: 'address', kind: 'text', value: p.address, view: p.address ?? '—' },
    { section: '土地の登記（表題部）', label: '地番', name: 'land_chiban', kind: 'text', value: p.land_chiban, view: p.land_chiban ?? '—' },
    { section: '土地の登記（表題部）', label: '地目', name: 'chimoku', kind: 'text', value: p.chimoku, view: p.chimoku ?? '—' },
    { section: '土地の登記（表題部）', label: '地積', name: 'area', kind: 'number', value: p.area != null ? String(p.area) : '', view: fmt.area(p.area) ?? '—' },
    { section: '土地の登記（表題部）', label: '原因及びその日付', name: 'land_cause', kind: 'text', value: p.land_cause, view: p.land_cause ?? '—' },
    { section: '土地の登記（権利部・甲区）', label: '現所有者名', name: 'land_owner_name', kind: 'text', value: p.land_owner_name, view: p.land_owner_name ?? '—' },
    { section: '土地の登記（権利部・甲区）', label: '所有者住所', name: 'land_owner_address', kind: 'text', value: p.land_owner_address, view: p.land_owner_address ?? '—' },
    { section: '土地の登記（権利部・甲区）', label: '所有権取得原因', name: 'land_acquisition_reason', kind: 'text', value: p.land_acquisition_reason, view: p.land_acquisition_reason ?? '—' },
    { section: '土地の登記（権利部・甲区）', label: '所有権取得日', name: 'land_acquisition_date', kind: 'date', value: p.land_acquisition_date ? String(p.land_acquisition_date).slice(0, 10) : '', view: fmt.date(p.land_acquisition_date) ?? '—' },
    { section: '土地の登記（権利部・甲区）', label: '差押有無', name: 'land_seizure', kind: 'select', value: p.land_seizure ? 'on' : '', options: [{ value: 'on', label: 'あり' }], view: fmt.bool(p.land_seizure) ?? '—' },
    { section: '土地の登記（権利部・甲区）', label: '直近差押解除日', name: 'land_seizure_release_date', kind: 'date', value: p.land_seizure_release_date ? String(p.land_seizure_release_date).slice(0, 10) : '', view: fmt.date(p.land_seizure_release_date) ?? '—' },
    { section: '建物の登記（表題部）', label: '不動産番号', name: 'building_fudosan_number', kind: 'text', value: p.building_fudosan_number, view: p.building_fudosan_number ?? '—' },
    { section: '建物の登記（表題部）', label: '所在', name: 'building_location', kind: 'text', value: p.building_location, view: p.building_location ?? '—' },
    { section: '建物の登記（表題部）', label: '家屋番号', name: 'building_kaoku_number', kind: 'text', value: p.building_kaoku_number, view: p.building_kaoku_number ?? '—' },
    { section: '建物の登記（表題部）', label: '種類', name: 'building_shurui', kind: 'text', value: p.building_shurui, view: p.building_shurui ?? '—' },
    { section: '建物の登記（表題部）', label: '構造', name: 'structure', kind: 'text', value: p.structure, view: p.structure ?? '—' },
    { section: '建物の登記（表題部）', label: '新築年月日', name: 'building_new_construction_date', kind: 'date', value: p.building_new_construction_date ? String(p.building_new_construction_date).slice(0, 10) : '', view: fmt.date(p.building_new_construction_date) ?? '—' },
    { section: '建物の登記（表題部）', label: '床面積・1階', name: 'building_floor_area_1f', kind: 'number', value: p.building_floor_area_1f != null ? String(p.building_floor_area_1f) : '', view: fmt.area(p.building_floor_area_1f) ?? '—' },
    { section: '建物の登記（表題部）', label: '床面積・2階', name: 'building_floor_area_2f', kind: 'number', value: p.building_floor_area_2f != null ? String(p.building_floor_area_2f) : '', view: fmt.area(p.building_floor_area_2f) ?? '—' },
    { section: '建物の登記（表題部）', label: '床面積・3階', name: 'building_floor_area_3f', kind: 'number', value: p.building_floor_area_3f != null ? String(p.building_floor_area_3f) : '', view: fmt.area(p.building_floor_area_3f) ?? '—' },
    { section: '建物の登記（甲区）', label: '現所有者名', name: 'building_owner_name', kind: 'text', value: p.building_owner_name, view: p.building_owner_name ?? '—' },
    { section: '建物の登記（甲区）', label: '所有者住所', name: 'building_owner_address', kind: 'text', value: p.building_owner_address, view: p.building_owner_address ?? '—' },
    { section: '建物の登記（甲区）', label: '所有権取得原因', name: 'building_acquisition_reason', kind: 'text', value: p.building_acquisition_reason, view: p.building_acquisition_reason ?? '—' },
    { section: '建物の登記（甲区）', label: '所有権取得日', name: 'building_acquisition_date', kind: 'date', value: p.building_acquisition_date ? String(p.building_acquisition_date).slice(0, 10) : '', view: fmt.date(p.building_acquisition_date) ?? '—' },
    { section: '建物の登記（甲区）', label: '差押有無', name: 'building_seizure', kind: 'select', value: p.building_seizure ? 'on' : '', options: [{ value: 'on', label: 'あり' }], view: fmt.bool(p.building_seizure) ?? '—' },
    { section: '建物の登記（甲区）', label: '直近差押解除日', name: 'building_seizure_release_date', kind: 'date', value: p.building_seizure_release_date ? String(p.building_seizure_release_date).slice(0, 10) : '', view: fmt.date(p.building_seizure_release_date) ?? '—' },
    { section: '建物の登記（乙区）', label: '登記種別', name: 'building_lien_type', kind: 'text', value: p.building_lien_type, view: p.building_lien_type ?? '—' },
    { section: '建物の登記（乙区）', label: '権利者名', name: 'building_lien_holder', kind: 'text', value: p.building_lien_holder, view: p.building_lien_holder ?? '—' },
    { section: '建物の登記（乙区）', label: '債権額', name: 'building_debt_amount', kind: 'number', value: p.building_debt_amount != null ? String(p.building_debt_amount) : '', view: fmt.debt(p.building_debt_amount) ?? '—' },
    { section: '建物の登記（乙区）', label: '損害金率', name: 'building_damage_rate', kind: 'number', value: p.building_damage_rate != null ? String(p.building_damage_rate) : '', view: fmt.rate(p.building_damage_rate) ?? '—' },
    { section: '建物の登記（乙区）', label: '共同担保目録番号', name: 'building_joint_collateral_number', kind: 'text', value: p.building_joint_collateral_number, view: p.building_joint_collateral_number ?? '—' },
    { section: '司法書士情報', label: '売り方・事務所', name: 'seller_scrivener_account_id', kind: 'select', value: p.seller_scrivener_account_id ?? '', options: accountOptions, view: sellerScrivenerAccount ? <Link href={`/accounts/${sellerScrivenerAccount.id}`} className="text-brand-700 hover:underline">{sellerScrivenerAccount.name}</Link> : <span className="text-zinc-300">—</span> },
    { section: '司法書士情報', label: '売り方・担当者', name: 'seller_scrivener_contact_id', kind: 'select', value: p.seller_scrivener_contact_id ?? '', options: contactOptions, view: sellerScrivenerContact ? <Link href={`/contacts/${sellerScrivenerContact.id}`} className="text-brand-700 hover:underline">{sellerScrivenerContact.full_name}</Link> : <span className="text-zinc-300">—</span> },
    { section: '司法書士情報', label: '買い方・事務所', name: 'buyer_scrivener_account_id', kind: 'select', value: p.buyer_scrivener_account_id ?? '', options: accountOptions, view: buyerScrivenerAccount ? <Link href={`/accounts/${buyerScrivenerAccount.id}`} className="text-brand-700 hover:underline">{buyerScrivenerAccount.name}</Link> : <span className="text-zinc-300">—</span> },
    { section: '司法書士情報', label: '買い方・担当者', name: 'buyer_scrivener_contact_id', kind: 'select', value: p.buyer_scrivener_contact_id ?? '', options: contactOptions, view: buyerScrivenerContact ? <Link href={`/contacts/${buyerScrivenerContact.id}`} className="text-brand-700 hover:underline">{buyerScrivenerContact.full_name}</Link> : <span className="text-zinc-300">—</span> },
    { section: '備考', label: '備考', name: 'description', kind: 'textarea', value: p.description, fullWidth: true, view: p.description ? p.description : <span className="text-zinc-300">—</span> },
  ] : [
    { label: '取引種別', name: 'transaction_type', kind: 'select', value: p.transaction_type, options: OTHER_TX_TYPES.map((t) => ({ value: t, label: t })), view: p.transaction_type ?? '—' },
    { label: '金額', name: 'price', kind: 'number', value: p.price != null ? String(p.price) : '', view: fmt.price(p.price) ?? '—' },
    { label: '登録日', view: p.created_at ? new Date(p.created_at).toLocaleDateString('ja-JP') : '—' },
    { label: '備考', name: 'description', kind: 'textarea', value: p.description, fullWidth: true, view: p.description ? p.description : <span className="text-zinc-300">—</span> },
  ]

  // ── stream ──────────────────────────────────────────────────────
  // stream（活動 / ToDo / 経費 / 履歴）は共通ヘルパで構築
  const { stream, interactionCount } = buildRecordStream({
    activities: activitiesList, tasks: tasksList, expenses: expensesList, changeLogs,
    activityTypeLabels: ACTIVITY_TYPE_LABELS, toggleTask,
  })
  const openTasks = tasksList.filter((t) => !t.done).length
  const expSum = expensesList.reduce((s, e) => s + Number(e.amount), 0)
  const aiEnabled = await isAIFeatureEnabled()

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer relatedToken={`properties:${id}`} revalidate={`/properties/${id}`} activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))} userInitial={p.name.trim()[0]} createActivity={quickCreateActivity} createTask={quickCreateTask} createExpense={quickCreateExpense} />
    </AuthGuard>
  )

  const kpis: KpiItem[] = [
    { icon: <Wallet />, label: isRE ? '価格 / 賃料' : '金額', value: fmt.price(p.price) ?? '—', sub: p.transaction_type ?? '—' },
    { icon: <Activity />, label: '活動', value: <>{activitiesList.length}<small> 件</small></>, sub: '活動履歴' },
    { icon: <SquareCheckBig />, label: '未完了ToDo', value: <>{openTasks}<small> 件</small></>, sub: `全 ${tasksList.length} 件` },
    { icon: <Receipt />, label: '経費', value: expSum ? `¥${expSum.toLocaleString()}` : '¥0', sub: `${expensesList.length} 件` },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '物件・商品', href: `/properties?view=${viewParam}` }, { label: p.name }]}
        avatar={<House className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={p.name}
        badges={<Badge tone={TX_TONE[p.transaction_type] ?? 'neutral'} dot>{p.transaction_type}</Badge>}
        meta={[
          ...(isRE && p.property_type ? [{ value: p.property_type }] : []),
          ...(account ? [{ icon: <NavIcon icon="🏢" className="w-3.5 h-3.5" />, value: <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{account.name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/properties/${id}/brokerage-report`} target="_blank" className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors" title="媒介業務処理状況報告書を新タブで印刷プレビュー"><span className="inline-flex items-center gap-1"><NavIcon icon="📄" className="w-3 h-3 shrink-0" />媒介報告書</span></Link>
              {aiEnabled && <AISummaryButton label="AIで活動をまとめる" action={handlePropertySummarize} />}
              <InlineEditButton event="bract:edit-property" />
              <DeleteButton action={handleDelete} confirmMessage="この物件を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5">
        <StageBar stages={PROPERTY_STAGES} currentStage={p.status} updateAction={changeStatus} />
      </div>

      <ApprovalSection objectType="properties" objectId={id} />

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard title={isRE ? '物件情報（登記など全項目）' : '商品情報'} dense canEdit={editFlag} editEvent="bract:edit-property" action={savePropertyInline} fields={propertyFields} />

            {(account || contact) && (
              <RefCard title="関連先" icon={<Building2 />}>
                {account && <MiniItem icon={<Building2 />} iconClass="bg-brand-50 text-brand-700" title={account.name} sub="取引先" href={`/accounts/${account.id}`} />}
                {contact && <MiniItem icon={<UserRound />} title={contact.full_name} sub="人物" href={`/contacts/${contact.id}`} />}
              </RefCard>
            )}

            <RefCard title="タグ" icon={<Tag />}>
              <TagsSection objectType="property" objectId={id} revalidatePath={`/properties/${id}`} />
            </RefCard>
          </>
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'related', label: '関連情報', icon: <Folder />, content: <div className="px-4 py-3"><RelatedRecordsSection objectType="properties" recordId={id} pagePath={`/properties/${id}`} /></div> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
