import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

const STATUS_COLORS: Record<string, string> = {
  '募集中': 'bg-blue-100 text-blue-700',
  '交渉中': 'bg-yellow-100 text-yellow-700',
  '成約':   'bg-green-100 text-green-700',
  '管理中': 'bg-purple-100 text-purple-700',
  '終了':   'bg-zinc-100 text-zinc-500',
}

const TX_COLORS: Record<string, string> = {
  '売買': 'bg-orange-50 text-orange-700',
  '賃貸': 'bg-cyan-50 text-cyan-700',
}

const FIELDS: FieldDef[] = [
  { value: 'name',        label: '物件名',   type: 'text' },
  { value: 'address',     label: '所在地',   type: 'text' },
  {
    value: 'property_type', label: '物件種別', type: 'select',
    options: ['マンション','戸建て','土地','ビル','店舗','倉庫','その他'].map((v) => ({ value: v, label: v })),
  },
  {
    value: 'transaction_type', label: '取引種別', type: 'select',
    options: [{ value: '売買', label: '売買' }, { value: '賃貸', label: '賃貸' }],
  },
  {
    value: 'status', label: 'ステータス', type: 'select',
    options: ['募集中','交渉中','成約','管理中','終了'].map((v) => ({ value: v, label: v })),
  },
  { value: 'price', label: '価格（円）', type: 'number' },
  { value: 'area',  label: '面積（㎡）', type: 'number' },
]

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[] }>
}) {
  const sp = await searchParams
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)

  const raw = await db.select({
    id:               properties.id,
    name:             properties.name,
    property_type:    properties.property_type,
    transaction_type: properties.transaction_type,
    status:           properties.status,
    address:          properties.address,
    area:             properties.area,
    price:            properties.price,
    built_year:       properties.built_year,
    accounts: { id: accounts.id, name: accounts.name },
    contacts: { id: contacts.id, full_name: contacts.full_name },
  })
    .from(properties)
    .leftJoin(accounts, eq(properties.account_id, accounts.id))
    .leftJoin(contacts, eq(properties.contact_id, contacts.id))
    .orderBy(desc(properties.created_at))

  const list      = applyFilters(raw as Record<string, unknown>[], conditions) as typeof raw
  const hasFilter = conditions.length > 0

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">物件・商品</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {list.length} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <Link
          href="/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ 新規登録
        </Link>
      </div>

      <FilterBuilder fields={FIELDS} initialFilters={filterRaw} basePath="/properties" />

      {list.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🏠</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する物件がありません' : '物件がまだありません'}
          </p>
          {hasFilter
            ? <Link href="/properties" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規登録」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">物件名</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">種別</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">所在地</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">面積</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">価格 / 賃料</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">ステータス</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {list.map((p) => {
                  const account = p.accounts?.id ? p.accounts : null
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/properties/${p.id}`} className="hover:text-blue-600">{p.name}</Link>
                        {account && <p className="text-xs text-zinc-400 mt-0.5">🏢 {account.name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-600 text-xs">{p.property_type}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium w-fit ${TX_COLORS[p.transaction_type] ?? ''}`}>{p.transaction_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-[12rem] truncate">{p.address ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-zinc-600 whitespace-nowrap">
                        {p.area ? `${Number(p.area).toLocaleString()} ㎡` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800 whitespace-nowrap">
                        {p.price ? `¥${Number(p.price).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/properties/${p.id}`} className="text-blue-600 hover:text-blue-800 text-xs">詳細 →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {list.map((p) => {
              const account = p.accounts?.id ? p.accounts : null
              return (
                <Link key={p.id} href={`/properties/${p.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900 text-sm leading-snug">{p.name}</span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    <span className="text-xs text-zinc-500">{p.property_type}</span>
                    <span className={`text-xs px-1.5 py-0 rounded font-medium ${TX_COLORS[p.transaction_type] ?? ''}`}>{p.transaction_type}</span>
                  </div>
                  {p.address && <p className="text-xs text-zinc-400 mt-1 truncate">📍 {p.address}</p>}
                  {account && <p className="text-xs text-zinc-400 mt-0.5">🏢 {account.name}</p>}
                  <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                    <span>{p.area ? `${Number(p.area).toLocaleString()} ㎡` : ''}</span>
                    {p.price && <span className="font-semibold text-zinc-800">¥{Number(p.price).toLocaleString()}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
