import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import { accounts, contacts, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import { eq, and, inArray, desc, asc, count } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteProperty } from '@/industries/real-estate/actions/properties'
import { toggleTaskDone } from '@/app/actions/tasks'
import DeleteButton from '@/components/DeleteButton'
import TagsSection from '@/components/TagsSection'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import ChangeLogSection from '@/components/ChangeLogSection'
import { getActivityTypes } from '@/lib/activityTypes'
import AISummaryButton from '@/components/AISummaryButton'
import { summarizeProperty } from '@/app/actions/ai'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'

const STATUS_COLORS: Record<string, string> = {
  '募集中': 'bg-blue-100 text-blue-700',
  '提案中': 'bg-blue-100 text-blue-700',
  '交渉中': 'bg-yellow-100 text-yellow-700',
  '成約':   'bg-green-100 text-green-700',
  '管理中': 'bg-purple-100 text-purple-700',
  '終了':   'bg-zinc-100 text-zinc-500',
}
const TX_COLORS: Record<string, string> = {
  '売買': 'bg-orange-50 text-orange-700 border-orange-200',
  '賃貸': 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

type DlItem = { label: string; value: string | null | undefined }

function Dl({ items }: { items: DlItem[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs text-zinc-400 mb-1">{label}</dt>
          <dd className="text-sm text-zinc-800">
            {value ? value : <span className="text-zinc-300">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
      <h2 className="text-sm font-bold text-zinc-700 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [row, activitiesList, tasksList, expensesList, activityTypes, changeLogCountRow] = await Promise.all([
    db.select().from(properties)
      .leftJoin(accounts, eq(properties.account_id, accounts.id))
      .leftJoin(contacts, eq(properties.contact_id, contacts.id))
      .where(eq(properties.id, id))
      .then((r) => r[0] ?? null),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('properties', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('properties', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('properties', id)))
      .orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'property'), eq(change_logs.object_id, id))),
  ])

  if (!row) notFound()

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'properties' && r.record_id === id)

  const p        = row.properties
  const account  = row.accounts?.id ? row.accounts : null
  const contact  = row.contacts?.id ? row.contacts : null
  const isRE     = p.product_category !== 'other'
  const viewParam = isRE ? 'real_estate' : 'other'

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  let sellerScrivenerAccount: { id: string; name: string } | null = null
  let sellerScrivenerContact: { id: string; full_name: string } | null = null
  let buyerScrivenerAccount:  { id: string; name: string } | null = null
  let buyerScrivenerContact:  { id: string; full_name: string } | null = null

  if (isRE) {
    const accountIds = [p.seller_scrivener_account_id, p.buyer_scrivener_account_id].filter(Boolean) as string[]
    const contactIds = [p.seller_scrivener_contact_id, p.buyer_scrivener_contact_id].filter(Boolean) as string[]

    const [scrAccounts, scrContacts] = await Promise.all([
      accountIds.length > 0
        ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds))
        : Promise.resolve([]),
      contactIds.length > 0
        ? db.select({ id: contacts.id, full_name: contacts.full_name }).from(contacts).where(inArray(contacts.id, contactIds))
        : Promise.resolve([]),
    ])

    const accMap = new Map(scrAccounts.map((a) => [a.id, a]))
    const conMap = new Map(scrContacts.map((c) => [c.id, c]))

    if (p.seller_scrivener_account_id) sellerScrivenerAccount = accMap.get(p.seller_scrivener_account_id) ?? null
    if (p.seller_scrivener_contact_id) sellerScrivenerContact = conMap.get(p.seller_scrivener_contact_id) ?? null
    if (p.buyer_scrivener_account_id)  buyerScrivenerAccount  = accMap.get(p.buyer_scrivener_account_id)  ?? null
    if (p.buyer_scrivener_contact_id)  buyerScrivenerContact  = conMap.get(p.buyer_scrivener_contact_id)  ?? null
  }

  async function handleDelete() {
    'use server'
    await deleteProperty(id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/properties/${id}`)
  }

  const fmt = {
    price:   (v: string | null) => v ? `¥${Number(v).toLocaleString()}` : null,
    area:    (v: string | null) => v ? `${Number(v).toLocaleString()} ㎡` : null,
    debt:    (v: number | null) => v ? `¥${v.toLocaleString()}` : null,
    rate:    (v: string | null) => v ? `${Number(v)}%` : null,
    bool:    (v: boolean | null) => v === true ? '✓ あり' : v === false ? 'なし' : null,
    date:    (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP') : null,
  }

  // ── 概要タブ ─────────────────────────────────────────────────────
  const overviewContent = (
    <>
      <Section title={isRE ? '物件情報' : '商品情報'}>
        <Dl items={isRE ? [
          { label: '物件種別',   value: p.property_type },
          { label: '取引種別',   value: p.transaction_type },
          { label: '価格 / 賃料', value: fmt.price(p.price) },
          { label: '登録日',     value: p.created_at ? new Date(p.created_at).toLocaleDateString('ja-JP') : null },
        ] : [
          { label: '取引種別',   value: p.transaction_type },
          { label: '金額',       value: fmt.price(p.price) },
          { label: '登録日',     value: p.created_at ? new Date(p.created_at).toLocaleDateString('ja-JP') : null },
        ]} />
        {!isRE && p.description && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <dt className="text-xs text-zinc-400 mb-1">備考</dt>
            <dd className="text-sm text-zinc-800 whitespace-pre-wrap">{p.description}</dd>
          </div>
        )}
      </Section>

      {isRE && (
        <>
          <Section title="🗺️ 土地の登記">
            <p className="text-xs font-semibold text-zinc-500 mb-3">表題部</p>
            <Dl items={[
              { label: '不動産番号',     value: p.land_fudosan_number },
              { label: '所在',           value: p.address },
              { label: '地番',           value: p.land_chiban },
              { label: '地目',           value: p.chimoku },
              { label: '地積',           value: fmt.area(p.area) },
              { label: '原因及びその日付', value: p.land_cause },
            ]} />
            <p className="text-xs font-semibold text-zinc-500 mt-5 mb-3 border-t border-zinc-100 pt-4">権利部（甲区）</p>
            <Dl items={[
              { label: '現所有者名',       value: p.land_owner_name },
              { label: '所有者住所',       value: p.land_owner_address },
              { label: '所有権取得原因',   value: p.land_acquisition_reason },
              { label: '所有権取得日',     value: fmt.date(p.land_acquisition_date) },
              { label: '差押有無',         value: fmt.bool(p.land_seizure) },
              { label: '直近差押解除日',   value: fmt.date(p.land_seizure_release_date) },
            ]} />
          </Section>

          <Section title="🏠 建物の登記">
            <p className="text-xs font-semibold text-zinc-500 mb-3">表題部</p>
            <Dl items={[
              { label: '不動産番号', value: p.building_fudosan_number },
              { label: '所在',       value: p.building_location },
              { label: '家屋番号',   value: p.building_kaoku_number },
              { label: '種類',       value: p.building_shurui },
              { label: '構造',       value: p.structure },
              { label: '新築年月日', value: fmt.date(p.building_new_construction_date) },
              { label: '床面積・1階', value: fmt.area(p.building_floor_area_1f) },
              { label: '床面積・2階', value: fmt.area(p.building_floor_area_2f) },
              { label: '床面積・3階', value: fmt.area(p.building_floor_area_3f) },
            ]} />
            <p className="text-xs font-semibold text-zinc-500 mt-5 mb-3 border-t border-zinc-100 pt-4">所有権・権利状態（甲区）</p>
            <Dl items={[
              { label: '現所有者名',     value: p.building_owner_name },
              { label: '所有者住所',     value: p.building_owner_address },
              { label: '所有権取得原因', value: p.building_acquisition_reason },
              { label: '所有権取得日',   value: fmt.date(p.building_acquisition_date) },
              { label: '差押有無',       value: fmt.bool(p.building_seizure) },
              { label: '直近差押解除日', value: fmt.date(p.building_seizure_release_date) },
            ]} />
            <p className="text-xs font-semibold text-zinc-500 mt-5 mb-3 border-t border-zinc-100 pt-4">担保・権利制限（乙区）</p>
            <Dl items={[
              { label: '登記種別',       value: p.building_lien_type },
              { label: '権利者名',       value: p.building_lien_holder },
              { label: '債権額',         value: fmt.debt(p.building_debt_amount) },
              { label: '損害金率',       value: fmt.rate(p.building_damage_rate) },
              { label: '共同担保目録番号', value: p.building_joint_collateral_number },
            ]} />
          </Section>

          <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
            <h2 className="text-sm font-bold text-zinc-700 mb-4">⚖️ 司法書士情報</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-600 border-b border-zinc-100 pb-1">売り方</p>
                <div>
                  <dt className="text-xs text-zinc-400 mb-1">事務所</dt>
                  <dd className="text-sm text-zinc-800">
                    {sellerScrivenerAccount
                      ? <Link href={`/accounts/${sellerScrivenerAccount.id}`} className="text-blue-600 hover:underline">{sellerScrivenerAccount.name}</Link>
                      : <span className="text-zinc-300">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
                  <dd className="text-sm text-zinc-800">
                    {sellerScrivenerContact
                      ? <Link href={`/contacts/${sellerScrivenerContact.id}`} className="text-blue-600 hover:underline">{sellerScrivenerContact.full_name}</Link>
                      : <span className="text-zinc-300">—</span>}
                  </dd>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-600 border-b border-zinc-100 pb-1">買い方</p>
                <div>
                  <dt className="text-xs text-zinc-400 mb-1">事務所</dt>
                  <dd className="text-sm text-zinc-800">
                    {buyerScrivenerAccount
                      ? <Link href={`/accounts/${buyerScrivenerAccount.id}`} className="text-blue-600 hover:underline">{buyerScrivenerAccount.name}</Link>
                      : <span className="text-zinc-300">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
                  <dd className="text-sm text-zinc-800">
                    {buyerScrivenerContact
                      ? <Link href={`/contacts/${buyerScrivenerContact.id}`} className="text-blue-600 hover:underline">{buyerScrivenerContact.full_name}</Link>
                      : <span className="text-zinc-300">—</span>}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {p.description && (
            <Section title="備考">
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{p.description}</p>
            </Section>
          )}
        </>
      )}

      <div className="mb-6">
        <RelatedRecordsSection
          objectType="properties"
          recordId={id}
          pagePath={`/properties/${id}`}
        />
      </div>
    </>
  )

  // AI 要約用 Server Action（id を closure に閉じ込める）
  async function handlePropertySummarize(from: string, to: string) {
    'use server'
    return summarizeProperty(id, from, to)
  }

  // ── 活動・ToDo・経費タブ ───────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      <AuthGuard minRole="editor">
        <p className="text-xs text-zinc-400 mb-3">作成画面の「関連レコード」で物件を選択してください</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/activities/new" className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          <Link href="/tasks/new"      className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          <Link href="/expenses/new"   className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
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
              <Link href={`/activities/new?custom_record_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
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
              <Link href={`/tasks/new?custom_record_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
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
              <Link href={`/expenses/new?custom_record_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expensesList.map((e) => (
              <div key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                <Link href={`/expenses/${e.id}`} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{e.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{e.category} · {e.expense_date}</p>
                  </div>
                  <span className="font-bold text-zinc-800 text-sm shrink-0">¥{Number(e.amount).toLocaleString()}</span>
                </Link>
                <OtherRelationsChips relations={(expenseRelMap.get(e.id) ?? []).filter(isNotSelf)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )

  // ── 履歴タブ ─────────────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType="property" objectId={id} />
    </div>
  )

  const tabsConfig: TabDef[] = [
    { id: 'overview', label: '概要', content: overviewContent },
  ]
  // AI まとめボタンを活動タブに合体
  // 注: AI 機能フラグ (AI_FEATURE_ENABLED) が false の場合はボタン自体を出さない。
  const aiEnabled = await isAIFeatureEnabled()
  const interactionsWithAI = (
    <>
      {aiEnabled && (
        <AuthGuard minRole="editor">
          <div className="mb-4 flex justify-end">
            <AISummaryButton label="🤖 AI で活動をまとめる" action={handlePropertySummarize} />
          </div>
        </AuthGuard>
      )}
      {interactionsContent}
    </>
  )

  tabsConfig.push({
    id: 'interactions',
    label: '活動・ToDo・経費',
    badge: interactionCount > 0 ? interactionCount : undefined,
    content: interactionsWithAI,
  })
  if (changeLogCount > 0) {
    tabsConfig.push({ id: 'history', label: '履歴', badge: changeLogCount, content: historyContent })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[
          { label: '物件・商品', href: `/properties?view=${viewParam}` },
          { label: p.name },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/properties/${id}/brokerage-report`} target="_blank" className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors" title="媒介業務処理状況報告書を新タブで印刷プレビュー">📄 媒介報告書</Link>
              <Link href={`/properties/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この物件を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{p.name}</h1>
        {(account || contact) && (
          <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-600 flex-wrap">
            {account && <Link href={`/accounts/${account.id}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">🏢 {account.name}</Link>}
            {account && contact && <span className="text-zinc-300">·</span>}
            {contact && <Link href={`/contacts/${contact.id}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">👤 {contact.full_name}</Link>}
          </div>
        )}
        <div className="mt-2 mb-3">
          <TagsSection objectType="property" objectId={id} revalidatePath={`/properties/${id}`} />
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {p.status}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-md border font-medium ${TX_COLORS[p.transaction_type] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
            {p.transaction_type}
          </span>
          {isRE && <span className="text-xs text-zinc-500">{p.property_type}</span>}
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
