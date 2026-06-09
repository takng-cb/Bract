import { db } from '@/lib/db'
import { accounts, taggables } from '@/lib/schema'
import { getAllTags } from '@/lib/tagUtils'
import { getAllUsers } from '@/lib/userUtils'
import { desc, eq, and, inArray, count } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, applyFilters, splitTagConditions, applyTagFilter,
  buildWhere, buildTagWhere, unresolvedConditions,
  type FilterColumnResolver,
} from '@/lib/filterUtils'
import { parseSortParams, applySort, buildOrderBy } from '@/lib/sortUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import AccountsTableView from '@/components/tableviews/AccountsTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { NavIcon } from '@/lib/navIcon'

const PAGE_SIZE = 20

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  // パフォーマンス最適化 (#40 Sprint 3+): getDefaultView を Round 1 と並列化。
  // userIdPromise を共有し、.then チェインで Promise.all 内で同時取得する。
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('accounts', uid) : null)
  const [sp, edit, colConfig, userId, dv] = await Promise.all([
    searchParams,
    canEdit(),
    getListViewColumns('accounts'),
    userIdPromise,
    dvPromise,
  ])

  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy   = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped = groupBy.length > 0

  // デフォルトビュー適用（URLにパラメータがない場合のみ）
  if (filterRaw.length === 0 && groupBy.length === 0) {
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
  const sortRaw  = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const _typeProbe = () => db.select().from(accounts)
  type SelectRow = Awaited<ReturnType<typeof _typeProbe>>[number]

  const resolver: FilterColumnResolver = {
    name:           { col: accounts.name,           type: 'text' },
    industry:       { col: accounts.industry,       type: 'text' },
    type:           { col: accounts.type,           type: 'select' },
    status:         { col: accounts.status,         type: 'select' },
    annual_revenue: { col: accounts.annual_revenue, type: 'number' },
    employee_count: { col: accounts.employee_count, type: 'number' },
    owner_id:       { col: accounts.owner_id,       type: 'select' },
  }

  // tag フィルタは buildTagWhere で SQL 化。resolver で解決できない条件のみ JS フォールバック。
  const useJsFallback = unresolvedConditions(otherConditions, resolver).length > 0

  let displayList: SelectRow[]
  let totalCount: number
  let allTags: Awaited<ReturnType<typeof getAllTags>>
  let allUsers: Awaited<ReturnType<typeof getAllUsers>>

  if (useJsFallback) {
    const [raw, tags, taggableRows, users] = await Promise.all([
      db.select().from(accounts).orderBy(desc(accounts.created_at)),
      getAllTags(),
      tagConditions.length > 0
        ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
            .from(taggables).where(and(
              eq(taggables.object_type, 'account'),
              inArray(taggables.tag_id, tagConditions.map((c) => c.value)),
            ))
        : Promise.resolve([] as { tag_id: string; object_id: string }[]),
      getAllUsers(),
    ])
    allTags  = tags
    allUsers = users

    const taggedIdsByTagId = new Map<string, Set<string>>()
    for (const t of taggableRows) {
      if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
      taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
    }

    let list = applyFilters(raw as Record<string, unknown>[], otherConditions) as SelectRow[]
    list = applyTagFilter(list, tagConditions, taggedIdsByTagId)
    const sorted = applySort(list as Record<string, unknown>[], sortDefs) as SelectRow[]
    totalCount = sorted.length
    displayList = isGrouped ? sorted : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  } else {
    const userWhere = buildWhere(otherConditions, resolver)
    const tagWhere = buildTagWhere(tagConditions, 'account', accounts.id)
    const where = and(userWhere, tagWhere)
    const orderBy = buildOrderBy(sortDefs, resolver)
    const finalOrderBy = orderBy.length > 0 ? orderBy : [desc(accounts.created_at)]

    const baseQuery = db.select().from(accounts).where(where).orderBy(...finalOrderBy)

    const [pageRows, totalRow, tags, users] = await Promise.all([
      isGrouped ? baseQuery : baseQuery.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      db.select({ count: count() }).from(accounts).where(where),
      getAllTags(),
      getAllUsers(),
    ])
    allTags  = tags
    allUsers = users
    totalCount  = Number(totalRow[0]?.count ?? 0)
    displayList = pageRows
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
    { value: 'owner_id', label: '担当者', type: 'select', options: allUsers.map((u) => ({ value: u.id, label: u.name })) },
    {
      value: 'tag', label: 'タグ', type: 'select',
      options: allTags.map((t) => ({ value: t.id, label: t.name })),
    },
  ]

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

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
          <div className="flex justify-center mb-4"><NavIcon icon="🏢" className="w-12 h-12 text-zinc-300" /></div>
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
            <TableErrorBoundary>
              <AccountsTableView
                records={displayList}
                groupBy={groupBy}
                fields={FIELDS}
                activeKeys={colConfig}
                currentSortStr={sortRaw}
              />
            </TableErrorBoundary>
          </div>
          {/* モバイル: カード（グルーピング対応） */}
          <div className="md:hidden">
            <MobileGroupedCards
              records={displayList}
              groupBy={groupBy}
              fields={FIELDS}
              renderCard={(rec) => {
                const a = rec as SelectRow
                return (
                  <Link href={`/accounts/${a.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm leading-snug">{a.name}</span>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'active'   ? 'bg-green-100 text-green-700' :
                        a.status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                                                   'bg-zinc-100 text-zinc-500'
                      }`}>
                        {a.status === 'active' ? '有効' : a.status === 'prospect' ? '見込み' : '無効'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                      {a.industry && <span>{a.industry}</span>}
                      {a.type && <span>{a.type}</span>}
                      {a.phone && <span className="inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3 h-3 shrink-0" />{a.phone}</span>}
                    </div>
                  </Link>
                )
              }}
            />
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/accounts" filterParams={filterRaw} />
      )}
    </div>
  )
}
