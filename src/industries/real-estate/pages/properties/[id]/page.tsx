import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteProperty } from '@/industries/real-estate/actions/properties'
import DeleteButton from '@/components/DeleteButton'
import TagsSection from '@/components/TagsSection'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'

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
    <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const row = await db.select().from(properties)
    .leftJoin(accounts, eq(properties.account_id, accounts.id))
    .leftJoin(contacts, eq(properties.contact_id, contacts.id))
    .where(eq(properties.id, id))
    .then((r) => r[0] ?? null)

  if (!row) notFound()

  // properties は専用 UI で全フィールドを表示するため、
  // 汎用カスタムフィールドカードは出さない（過去の migrate スクリプトが残した
  // schema 列の field_definitions 複製が二重表示の原因になっていたため）。

  const p        = row.properties
  const account  = row.accounts?.id ? row.accounts : null
  const contact  = row.contacts?.id ? row.contacts : null
  const isRE     = p.product_category !== 'other'
  const viewParam = isRE ? 'real_estate' : 'other'

  // 司法書士の名前を別途取得（不動産のみ）
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

  const fmt = {
    price:   (v: string | null) => v ? `¥${Number(v).toLocaleString()}` : null,
    area:    (v: string | null) => v ? `${Number(v).toLocaleString()} ㎡` : null,
    debt:    (v: number | null) => v ? `¥${v.toLocaleString()}` : null,
    rate:    (v: string | null) => v ? `${Number(v)}%` : null,
    bool:    (v: boolean | null) => v === true ? '✓ あり' : v === false ? 'なし' : null,
    date:    (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP') : null,
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
              <Link href={`/properties/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">✏️ 編集</Link>
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

      {/* 物件情報（共通） */}
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

      {/* ── 不動産のみ ── */}
      {isRE && (
        <>
          {/* 土地の登記 */}
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

          {/* 建物の登記 */}
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

          {/* 司法書士情報 */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">⚖️ 司法書士情報</h2>
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

          {/* 備考 */}
          {p.description && (
            <Section title="備考">
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{p.description}</p>
            </Section>
          )}
        </>
      )}

      {/* 関係性（多対多） */}
      <div className="mb-6">
        <RelatedRecordsSection
          objectType="properties"
          recordId={id}
          pagePath={`/properties/${id}`}
        />
      </div>

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
