import { db } from '@/lib/db'
import { contacts, accounts, tags, taggables } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import CsvToolbar from '@/components/CsvToolbar'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[] }>
}) {
  const sp = await searchParams
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)

  const [raw, allTags, taggableRows] = await Promise.all([
    db.select({
      id:         contacts.id,
      full_name:  contacts.full_name,
      email:      contacts.email,
      phone:      contacts.phone,
      title:      contacts.title,
      department: contacts.department,
      account_id: contacts.account_id,
      accounts: {
        id:   accounts.id,
        name: accounts.name,
      },
    })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
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

  const FIELDS: FieldDef[] = [
    { value: 'full_name',     label: '氏名',   type: 'text' },
    { value: 'email',         label: 'メール', type: 'text' },
    { value: 'title',         label: '役職',   type: 'text' },
    { value: 'department',    label: '部署',   type: 'text' },
    { value: 'accounts.name', label: '取引先', type: 'text' },
    {
      value: 'tag', label: 'タグ', type: 'select',
      options: allTags.map((t) => ({ value: t.id, label: t.name })),
    },
  ]

  let contactsList = applyFilters(raw as Record<string, unknown>[], otherConditions)
  contactsList     = applyTagFilter(contactsList, tagConditions, taggedIdsByTagId)
  const hasFilter  = conditions.length > 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">担当者</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {contactsList.length} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/contacts"
            importUrl="/api/import/contacts"
            label="担当者"
          />
          <Link
            href="/contacts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規作成
          </Link>
        </div>
      </div>

      <FilterBuilder
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/contacts"
      />

      {contactsList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">👤</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する担当者がいません' : '担当者がまだいません'}
          </p>
          {hasFilter
            ? <Link href="/contacts" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">氏名</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">会社</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">役職 / 部署</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">メール</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">電話</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(contactsList as typeof raw).map((c) => {
                const account = c.accounts?.id ? c.accounts : null
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <Link href={`/contacts/${c.id}`} className="hover:text-blue-600">{c.full_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {account
                        ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">{account.name}</Link>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <span>{c.title ?? '—'}</span>
                      {c.department && <span className="text-zinc-400 ml-1 text-xs">/ {c.department}</span>}
                    </td>
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
      )}
    </div>
  )
}
