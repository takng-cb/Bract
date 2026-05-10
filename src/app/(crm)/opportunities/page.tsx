import { db } from '@/lib/db'
import { opportunities, accounts, taggables } from '@/lib/schema'
import { activeIndustry } from '@/lib/industry'
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
import OpportunitiesTableView from '@/components/tableviews/OpportunitiesTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'

const PAGE_SIZE = 20

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  prospecting:   { label: '見込み',   color: 'bg-zinc-100 text-zinc-600' },
  qualification: { label: '要件確認', color: 'bg-blue-100 text-blue-700' },
  proposal:      { label: '提案',     color: 'bg-yellow-100 text-yellow-700' },
  negotiation:   { label: '交渉',     color: 'bg-orange-100 text-orange-700' },
  closed_won:    { label: '受注',     color: 'bg-green-100 text-green-700' },
  closed_lost:   { label: '失注',     color: 'bg-red-100 text-red-600' },
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  const [sp, edit, colConfig, userId] = await Promise.all([searchParams, canEdit(), getListViewColumns('opportunities'), getCurrentUserId()])
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0

  if (filterRaw.length === 0 && groupBy.length === 0) {
    const dv = await getDefaultView('opportunities', userId)
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/opportunities?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)
  const sortRaw = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  // SQL ベースのページング・フィルタ・ソートに使う resolver
  const resolver: FilterColumnResolver = {
    name:             { col: opportunities.name,        type: 'text' },
    'accounts.name':  { col: accounts.name,             type: 'text' },
    stage:            { col: opportunities.stage,       type: 'select' },
    amount:           { col: opportunities.amount,      type: 'number' },
    probability:      { col: opportunities.probability, type: 'number' },
    close_date:       { col: opportunities.close_date,  type: 'date' },
    owner_id:         { col: opportunities.owner_id,    type: 'select' },
  }

  // resolver で解決できないフィルタがある場合のみ JS フォールバック。
  // tag フィルタは buildTagWhere で SQL に押し下げる。
  const useJsFallback = unresolvedConditions(otherConditions, resolver).length > 0

  // 共通の SELECT 形（ページデータ取得用）
  const selectShape = {
    id:          opportunities.id,
    name:        opportunities.name,
    stage:       opportunities.stage,
    amount:      opportunities.amount,
    probability: opportunities.probability,
    close_date:  opportunities.close_date,
    account_id:  opportunities.account_id,
    owner_id:    opportunities.owner_id,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
  } as const

  // 行型を Drizzle に推論させるためのダミー（実行はしない）
  const _typeProbe = () => db.select(selectShape)
    .from(opportunities)
    .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
  type SelectRow = Awaited<ReturnType<typeof _typeProbe>>[number]
  let displayList: SelectRow[]
  let totalCount: number
  let allTags: Awaited<ReturnType<typeof getAllTags>>
  let allUsers: Awaited<ReturnType<typeof getAllUsers>>

  if (useJsFallback) {
    // ── JS フォールバック（既存の挙動と同じ）──
    const [raw, tags, taggableRows, users] = await Promise.all([
      db.select(selectShape)
        .from(opportunities)
        .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
        .orderBy(desc(opportunities.created_at)),
      getAllTags(),
      tagConditions.length > 0
        ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
            .from(taggables).where(and(
              eq(taggables.object_type, 'opportunity'),
              inArray(taggables.tag_id, tagConditions.map((c) => c.value)),
            ))
        : Promise.resolve([] as { tag_id: string; object_id: string }[]),
      getAllUsers(),
    ])
    allTags = tags
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
    // ── SQL fast path ──
    const userWhere = buildWhere(otherConditions, resolver)
    const tagWhere = buildTagWhere(tagConditions, 'opportunity', opportunities.id)
    // and(undefined, x, y) は drizzle が undefined を無視するため安全
    const where = and(userWhere, tagWhere)
    const orderBy = buildOrderBy(sortDefs, resolver)
    const finalOrderBy = orderBy.length > 0 ? orderBy : [desc(opportunities.created_at)]

    const baseQuery = db.select(selectShape)
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .where(where)
      .orderBy(...finalOrderBy)

    const [pageRows, totalRow, tags, users] = await Promise.all([
      isGrouped ? baseQuery : baseQuery.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      db.select({ count: count() })
        .from(opportunities)
        .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
        .where(where),
      getAllTags(),
      getAllUsers(),
    ])
    allTags = tags
    allUsers = users
    totalCount = Number(totalRow[0]?.count ?? 0)
    displayList = pageRows
  }

  const FIELDS: FieldDef[] = [
    { value: 'name',          label: '商談名',    type: 'text' },
    { value: 'accounts.name', label: '取引先',    type: 'text' },
    {
      value: 'stage', label: 'ステージ', type: 'select',
      options: [
        { value: 'prospecting',   label: '見込み' },
        { value: 'qualification', label: '要件確認' },
        { value: 'proposal',      label: '提案' },
        { value: 'negotiation',   label: '交渉' },
        { value: 'closed_won',    label: '受注' },
        { value: 'closed_lost',   label: '失注' },
      ],
    },
    { value: 'amount',      label: '金額（円）', type: 'number' },
    { value: 'probability', label: '確度（%）',  type: 'number' },
    { value: 'close_date',  label: '完了予定日', type: 'date' },
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
          <h1 className="text-2xl font-bold text-zinc-900">商談</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/opportunities"
            importUrl="/api/import/opportunities"
            label="商談"
            csvFormat={activeIndustry === 'real-estate'
              ? "ID,商談名,ステージ,金額,完了予定日,確度(%),取引先名,説明,取引区分,仲介手数料,仲介種別,その他利益"
              : "ID,商談名,ステージ,金額,完了予定日,確度(%),取引先名,説明"}
            fieldOptions={{
              'ステージ': ['見込み', '要件確認', '提案', '交渉', '受注', '失注'],
              ...(activeIndustry === 'real-estate' ? {
                '取引区分': ['売買', '賃貸'],
                '仲介種別': ['両手', '売り', '買い', '貸主', '借主'],
              } : {}),
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/opportunities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      <SavedViewsPanel
        objectType="opportunities"
        basePath="/opportunities"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/opportunities"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">💼</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する商談がありません' : '商談がまだありません'}
          </p>
          {hasFilter
            ? <Link href="/opportunities" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <OpportunitiesTableView
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
                const o = rec as SelectRow
                const stageConf = STAGE_LABELS[o.stage] ?? { label: o.stage, color: 'bg-zinc-100 text-zinc-600' }
                const account   = o.accounts?.id ? o.accounts : null
                return (
                  <Link href={`/opportunities/${o.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm leading-snug">{o.name}</span>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${stageConf.color}`}>{stageConf.label}</span>
                    </div>
                    {account && <p className="text-xs text-zinc-500 mt-0.5">🏢 {account.name}</p>}
                    <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                      <span>{o.close_date ? `📅 ${o.close_date}` : '期限なし'}</span>
                      <div className="text-right">
                        {o.amount && <span className="font-semibold text-zinc-800">¥{Number(o.amount).toLocaleString()}</span>}
                        {o.probability != null && <span className="ml-2 text-zinc-400">確度{o.probability}%</span>}
                      </div>
                    </div>
                  </Link>
                )
              }}
            />
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/opportunities" filterParams={filterRaw} />
      )}
    </div>
  )
}
