import { db } from '@/lib/db'
import { contacts, accounts, tags, taggables } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 20

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; view?: string }>
}) {
  const sp = await searchParams
  const view       = (sp.view === 'consumer') ? 'consumer' : 'business'
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)

  const [raw, allTags, taggableRows] = await Promise.all([
    db.select({
      id:           contacts.id,
      contact_type: contacts.contact_type,
      full_name:    contacts.full_name,
      email:        contacts.email,
      phone:        contacts.phone,
      title:        contacts.title,
      department:   contacts.department,
      account_id:   contacts.account_id,
      accounts: {
        id:   accounts.id,
        name: accounts.name,
      },
    })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(eq(contacts.contact_type, view))
      .orderBy(desc(contacts.created_at)),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(tags.name),
    tagConditions.length > 0
      ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
          .from(taggables).where(eq(taggables.object_type, 'contact'))
      : Promise.resolve([]),
  ])

  const taggedIdsByTagId = new Map<string, Set<string>>()
  for (const t of taggableRows) {
    if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
    taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
  }

  const FIELDS_BUSINESS: FieldDef[] = [
    { value: 'full_name',     label: '氏名',   type: 'text' },
    { value: 'email',         label: 'メール', type: 'text' },
    { value: 'title',         label: '役職',   type: 'text' },
    { value: 'department',    label: '部署',   type: 'text' },
    { value: 'accounts.name', label: '取引先', type: 'text' },
    { value: 'tag', label: 'タグ', type: 'select', options: allTags.map((t) => ({ value: t.id, label: t.name })) },
  ]
  const FIELDS_CONSUMER: FieldDef[] = [
    { value: 'full_name', label: '氏名',   type: 'text' },
    { value: 'email',     label: 'メール', type: 'text' },
    { value: 'phone',     label: '電話',   type: 'text' },
    { value: 'tag', label: 'タグ', type: 'select', options: allTags.map((t) => ({ value: t.id, label: t.name })) },
  ]
  const FIELDS = view === 'business' ? FIELDS_BUSINESS : FIELDS_CONSUMER

  let contactsList = applyFilters(raw as Record<string, unknown>[], otherConditions)
  contactsList     = applyTagFilter(contactsList, tagConditions, taggedIdsByTagId)
  const hasFilter  = conditions.length > 0
  const totalCount = contactsList.length
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const pagedList  = contactsList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabBase  = (v: string) => `/contacts?view=${v}`
  const newHref  = `/contacts/new?view=${view}`
  const isBiz    = view === 'business'

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">人物</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/contacts"
            importUrl="/api/import/contacts"
            label="人物"
          />
          <Link
            href={newHref}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規作成
          </Link>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4 border-b border-zinc-200">
        {[
          { value: 'business', label: '法人担当（ToB）' },
          { value: 'consumer', label: '個人顧客（ToC）' },
        ].map(({ value, label }) => (
          <Link
            key={value}
            href={tabBase(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <FilterBuilder
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/contacts"
        persistParams={{ view }}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">{isBiz ? '👔' : '👤'}</p>
          <p className="text-lg font-medium">
            {hasFilter
              ? `条件に一致する${isBiz ? '法人担当者' : '個人顧客'}がいません`
              : `${isBiz ? '法人担当者' : '個人顧客'}がまだいません`}
          </p>
          {hasFilter
            ? <Link href={tabBase(view)} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">氏名</th>
                  {isBiz && <th className="text-left px-4 py-3 font-medium text-zinc-600">会社</th>}
                  {isBiz && <th className="text-left px-4 py-3 font-medium text-zinc-600">役職 / 部署</th>}
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">メール</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">電話</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(pagedList as typeof raw).map((c) => {
                  const account = c.accounts?.id ? c.accounts : null
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/contacts/${c.id}`} className="hover:text-blue-600">{c.full_name}</Link>
                      </td>
                      {isBiz && (
                        <td className="px-4 py-3 text-zinc-600">
                          {account ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">{account.name}</Link> : '—'}
                        </td>
                      )}
                      {isBiz && (
                        <td className="px-4 py-3 text-zinc-600">
                          <span>{c.title ?? '—'}</span>
                          {c.department && <span className="text-zinc-400 ml-1 text-xs">/ {c.department}</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-zinc-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/contacts/${c.id}`} className="text-blue-600 hover:text-blue-800 text-xs">詳細 →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {(pagedList as typeof raw).map((c) => {
              const account = c.accounts?.id ? c.accounts : null
              return (
                <Link key={c.id} href={`/contacts/${c.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900 text-sm">{isBiz ? '👔' : '👤'} {c.full_name}</span>
                    {isBiz && c.title && <span className="shrink-0 text-xs text-zinc-500">{c.title}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                    {isBiz && account && <span>🏢 {account.name}</span>}
                    {isBiz && c.department && <span>{c.department}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {c.phone && <span>📞 {c.phone}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/contacts"
        filterParams={filterRaw}
        extraParams={{ view }}
      />
    </div>
  )
}
