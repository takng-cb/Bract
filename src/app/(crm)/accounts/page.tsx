import { db } from '@/lib/db'
import { accounts, tags, taggables } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import CsvToolbar from '@/components/CsvToolbar'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[] }>
}) {
  const sp = await searchParams
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)

  const [raw, allTags, taggableRows] = await Promise.all([
    db.select().from(accounts).orderBy(desc(accounts.created_at)),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(tags.name),
    tagConditions.length > 0
      ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
          .from(taggables).where(eq(taggables.object_type, 'account'))
      : Promise.resolve([]),
  ])

  const taggedIdsByTagId = new Map<string, Set<string>>()
  for (const t of taggableRows) {
    if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
    taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
  }

  const FIELDS: FieldDef[] = [
    { value: 'name',     label: '会社名', type: 'text' },
    { value: 'industry', label: '業種',   type: 'text' },
    {
      value: 'type', label: '種別', type: 'select',
      options: [
        { value: '顧客',     label: '顧客' },
        { value: '見込み客', label: '見込み客' },
        { value: 'パートナー', label: 'パートナー' },
        { value: '競合他社', label: '競合他社' },
        { value: 'その他',   label: 'その他' },
      ],
    },
    {
      value: 'status', label: 'ステータス', type: 'select',
      options: [
        { value: 'active',   label: '有効' },
        { value: 'inactive', label: '無効' },
      ],
    },
    { value: 'annual_revenue', label: '年間売上（円）', type: 'number' },
    { value: 'employee_count', label: '従業員数',       type: 'number' },
    {
      value: 'tag', label: 'タグ', type: 'select',
      options: allTags.map((t) => ({ value: t.id, label: t.name })),
    },
  ]

  let accountsList = applyFilters(raw as Record<string, unknown>[], otherConditions)
  accountsList     = applyTagFilter(accountsList, tagConditions, taggedIdsByTagId)
  const hasFilter  = conditions.length > 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">取引先</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {accountsList.length} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/accounts"
            importUrl="/api/import/accounts"
            label="取引先"
          />
          <Link
            href="/accounts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規作成
          </Link>
        </div>
      </div>

      <FilterBuilder
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/accounts"
      />

      {accountsList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🏢</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する取引先がありません' : '取引先がまだありません'}
          </p>
          {hasFilter
            ? <Link href="/accounts" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">会社名</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">業種</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">種別</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">電話番号</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">ステータス</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(accountsList as typeof raw).map((account) => (
                <tr key={account.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">
                      {account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{account.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{account.type ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{account.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      account.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {account.status === 'active' ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:text-blue-800 text-xs">
                      詳細 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
