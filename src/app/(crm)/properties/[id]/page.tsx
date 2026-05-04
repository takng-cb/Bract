import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteProperty } from '@/app/actions/properties'
import DeleteButton from '@/components/DeleteButton'
import TagsSection from '@/components/TagsSection'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'

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

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 基本情報取得
  const row = await db.select({
    id:               properties.id,
    product_category: properties.product_category,
    name:             properties.name,
    property_type:    properties.property_type,
    transaction_type: properties.transaction_type,
    status:           properties.status,
    address:          properties.address,
    area:             properties.area,
    price:            properties.price,
    floor:            properties.floor,
    total_floors:     properties.total_floors,
    built_year:       properties.built_year,
    chimoku:          properties.chimoku,
    structure:        properties.structure,
    rights_status:    properties.rights_status,
    description:      properties.description,
    created_at:       properties.created_at,
    account_id:                  properties.account_id,
    contact_id:                  properties.contact_id,
    seller_scrivener_account_id: properties.seller_scrivener_account_id,
    seller_scrivener_contact_id: properties.seller_scrivener_contact_id,
    buyer_scrivener_account_id:  properties.buyer_scrivener_account_id,
    buyer_scrivener_contact_id:  properties.buyer_scrivener_contact_id,
    accounts: { id: accounts.id, name: accounts.name },
    contacts: { id: contacts.id, full_name: contacts.full_name },
  })
    .from(properties)
    .leftJoin(accounts, eq(properties.account_id, accounts.id))
    .leftJoin(contacts, eq(properties.contact_id, contacts.id))
    .where(eq(properties.id, id))
    .then((r) => r[0] ?? null)

  if (!row) notFound()

  const isRE      = row.product_category !== 'other'
  const viewParam = isRE ? 'real_estate' : 'other'
  const account   = row.accounts?.id ? row.accounts : null
  const contact   = row.contacts?.id ? row.contacts : null

  // 司法書士の名前を別途取得（不動産のみ）
  let sellerScrivenerAccount: { id: string; name: string } | null = null
  let sellerScrivenerContact: { id: string; full_name: string } | null = null
  let buyerScrivenerAccount:  { id: string; name: string } | null = null
  let buyerScrivenerContact:  { id: string; full_name: string } | null = null

  if (isRE) {
    const accountIds = [row.seller_scrivener_account_id, row.buyer_scrivener_account_id].filter(Boolean) as string[]
    const contactIds = [row.seller_scrivener_contact_id, row.buyer_scrivener_contact_id].filter(Boolean) as string[]

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

    if (row.seller_scrivener_account_id) sellerScrivenerAccount = accMap.get(row.seller_scrivener_account_id) ?? null
    if (row.seller_scrivener_contact_id) sellerScrivenerContact = conMap.get(row.seller_scrivener_contact_id) ?? null
    if (row.buyer_scrivener_account_id)  buyerScrivenerAccount  = accMap.get(row.buyer_scrivener_account_id)  ?? null
    if (row.buyer_scrivener_contact_id)  buyerScrivenerContact  = conMap.get(row.buyer_scrivener_contact_id)  ?? null
  }

  async function handleDelete() {
    'use server'
    await deleteProperty(id)
  }

  const detailItems = isRE ? [
    { label: '物件種別',   value: row.property_type },
    { label: '取引種別',   value: row.transaction_type },
    { label: '所在地',     value: row.address },
    { label: '面積',       value: row.area   ? `${Number(row.area).toLocaleString()} ㎡` : null },
    { label: '価格 / 賃料', value: row.price  ? `¥${Number(row.price).toLocaleString()}` : null },
    { label: '所在階',     value: row.floor        ? `${row.floor}階` : null },
    { label: '総階数',     value: row.total_floors ? `${row.total_floors}階建て` : null },
    { label: '築年',       value: row.built_year   ? `${row.built_year}年` : null },
    { label: '地目',       value: row.chimoku       ?? null },
    { label: '構造',       value: row.structure     ?? null },
    { label: '権利状況',   value: row.rights_status ?? null },
    { label: '関連取引先', value: account ? account.name : null, href: account ? `/accounts/${account.id}` : undefined },
    { label: '関連人物',   value: contact ? contact.full_name : null, href: contact ? `/contacts/${contact.id}` : undefined },
    { label: '登録日',     value: row.created_at ? new Date(row.created_at).toLocaleDateString('ja-JP') : null },
  ] : [
    { label: '取引種別',   value: row.transaction_type },
    { label: '金額',       value: row.price ? `¥${Number(row.price).toLocaleString()}` : null },
    { label: '関連取引先', value: account ? account.name : null, href: account ? `/accounts/${account.id}` : undefined },
    { label: '関連人物',   value: contact ? contact.full_name : null, href: contact ? `/contacts/${contact.id}` : undefined },
    { label: '登録日',     value: row.created_at ? new Date(row.created_at).toLocaleDateString('ja-JP') : null },
  ]

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href={`/properties?view=${viewParam}`} className="hover:text-zinc-600">物件・商品</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 line-clamp-1">{row.name}</span>
      </div>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 min-w-0 break-words">{row.name}</h1>
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <Link href={`/properties/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この物件を削除しますか？" />
            </div>
          </AuthGuard>
        </div>
        <div className="mt-2 mb-3">
          <TagsSection objectType="property" objectId={id} revalidatePath={`/properties/${id}`} />
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {row.status}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-md border font-medium ${TX_COLORS[row.transaction_type] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
            {row.transaction_type}
          </span>
          {isRE && <span className="text-xs text-zinc-500">{row.property_type}</span>}
        </div>
      </div>

      {/* 物件・商品情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">{isRE ? '物件情報' : '商品情報'}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {detailItems.map(({ label, value, href }) => (
            <div key={label}>
              <dt className="text-xs text-zinc-400 mb-1">{label}</dt>
              <dd className="text-sm text-zinc-800">
                {value
                  ? href
                    ? <Link href={href} className="text-blue-600 hover:underline">{value}</Link>
                    : value
                  : <span className="text-zinc-300">—</span>
                }
              </dd>
            </div>
          ))}
        </dl>

        {/* 備考 */}
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">備考</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {row.description ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>
      </div>

      {/* 不動産：司法書士情報 */}
      {isRE && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">⚖️ 司法書士情報</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 売り方 */}
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
            {/* 買い方 */}
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
      )}

      {/* 編集リンク */}
      <div className="flex gap-3">
        <AuthGuard minRole="editor">
          <Link href={`/properties/${id}/edit`} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            編集する
          </Link>
        </AuthGuard>
        <Link href={`/properties?view=${viewParam}`} className="px-4 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50 transition-colors">
          一覧に戻る
        </Link>
      </div>
      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
