import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteProperty } from '@/app/actions/properties'
import DeleteButton from '@/components/DeleteButton'
import TagsSection from '@/components/TagsSection'

const STATUS_COLORS: Record<string, string> = {
  '募集中': 'bg-blue-100 text-blue-700',
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

  const row = await db.select({
    id:               properties.id,
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
    description:      properties.description,
    created_at:       properties.created_at,
    accounts: { id: accounts.id, name: accounts.name },
    contacts: { id: contacts.id, full_name: contacts.full_name },
  })
    .from(properties)
    .leftJoin(accounts, eq(properties.account_id, accounts.id))
    .leftJoin(contacts, eq(properties.contact_id, contacts.id))
    .where(eq(properties.id, id))
    .then((r) => r[0] ?? null)

  if (!row) notFound()

  const account = row.accounts?.id ? row.accounts : null
  const contact = row.contacts?.id ? row.contacts : null

  async function handleDelete() {
    'use server'
    await deleteProperty(id)
  }

  const detailItems = [
    { label: '物件種別',   value: row.property_type },
    { label: '取引種別',   value: row.transaction_type },
    { label: '所在地',     value: row.address },
    { label: '面積',       value: row.area   ? `${Number(row.area).toLocaleString()} ㎡` : null },
    { label: '価格 / 賃料', value: row.price  ? `¥${Number(row.price).toLocaleString()}` : null },
    { label: '所在階',     value: row.floor        ? `${row.floor}階` : null },
    { label: '総階数',     value: row.total_floors ? `${row.total_floors}階建て` : null },
    { label: '築年',       value: row.built_year   ? `${row.built_year}年` : null },
    { label: '関連取引先', value: account ? account.name : null, href: account ? `/accounts/${account.id}` : undefined },
    { label: '関連担当者', value: contact ? contact.full_name : null, href: contact ? `/contacts/${contact.id}` : undefined },
    { label: '登録日',     value: row.created_at ? new Date(row.created_at).toLocaleDateString('ja-JP') : null },
  ]

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/properties" className="hover:text-zinc-600">物件・商品</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 line-clamp-1">{row.name}</span>
      </div>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 min-w-0 break-words">{row.name}</h1>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <Link href={`/properties/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">編集</Link>
            <DeleteButton action={handleDelete} confirmMessage="この物件を削除しますか？" />
          </div>
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
          <span className="text-xs text-zinc-500">{row.property_type}</span>
        </div>
      </div>

      {/* 物件情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">物件情報</h2>
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

      {/* 編集リンク */}
      <div className="flex gap-3">
        <Link href={`/properties/${id}/edit`} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
          編集する
        </Link>
        <Link href="/properties" className="px-4 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50 transition-colors">
          一覧に戻る
        </Link>
      </div>
    </div>
  )
}
