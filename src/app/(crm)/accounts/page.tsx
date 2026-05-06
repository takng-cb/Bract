import { db } from '@/lib/db'
import { accounts, tags, taggables } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import AccountsTableView from '@/components/tableviews/AccountsTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'

const PAGE_SIZE = 20

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  const [sp, edit, colConfig, userId] = await Promise.all([
    searchParams,
    canEdit(),
    getListViewColumns('accounts'),
    getCurrentUserId(),
  ])

  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0

  // デフォルトビュー適用（URLにパラメータがない場合のみ）
  if (filterRaw.length === 0 && groupBy.length === 0) {
    const dv = await getDefaultView('accounts', userId)
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/accounts?${p.toString()}`)
    }
  }

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
        { value: 'prospect', label: '見込み' },
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
  const sortRaw    = sp.sort ?? ''
  const sorted     = applySort(accountsList as Record<string, unknown>[], parseSortParams(sortRaw))
  const hasFilter  = conditions.length > 0
  const totalCount = sorted.length
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const groupableFields = FIELDS
    .filter((f) => f.value !== 'tag')
    .map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">取引先</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/accounts"
            importUrl="/api/import/accounts"
            label="取引先"
            csvFormat="ID,会社名,種別,業種,電話番号,Webサイト,住所,年間売上,従業員数,ステータス,メモ"
            fieldOptions={{
              '種別': ['顧客', '見込み客', 'パートナー', '競合他社', 'その他'],
              '業種': ['IT・ソフトウェア', '製造業', '商社', '金融・保険', '医療・ヘルスケア', '広告・マーケティング', '小売・EC', '食品・飲料', 'エネルギー', '教育', '不動産', '弁護士', '司法書士', '税理士', '行政書士', 'その他'],
              'ステータス': ['見込み', '有効', '無効'],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/accounts/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      <SavedViewsPanel
        objectType="accounts"
        basePath="/accounts"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/accounts"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
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
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <AccountsTableView
              records={displayList}
              groupBy={groupBy}
              fields={FIELDS}
              activeKeys={colConfig}
            />
          </div>
          {/* モバイル: カード（グルーピング非対応） */}
          {!isGrouped && (
            <div className="md:hidden space-y-2">
              {(displayList as typeof raw).map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900 text-sm leading-snug">{account.name}</span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      account.status === 'active'   ? 'bg-green-100 text-green-700' :
                      account.status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                                                      'bg-zinc-100 text-zinc-500'
                    }`}>
                      {account.status === 'active' ? '有効' : account.status === 'prospect' ? '見込み' : '無効'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                    {account.industry && <span>{account.industry}</span>}
                    {account.type && <span>{account.type}</span>}
                    {account.phone && <span>📞 {account.phone}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/accounts" filterParams={filterRaw} />
      )}
    </div>
  )
}
