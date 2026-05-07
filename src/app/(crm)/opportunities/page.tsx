import { db } from '@/lib/db'
import { opportunities, accounts, tags, taggables } from '@/lib/schema'
import { desc, eq, and, inArray } from 'drizzle-orm'
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

  const [raw, allTags, taggableRows] = await Promise.all([
    db.select({
      id:          opportunities.id,
      name:        opportunities.name,
      stage:       opportunities.stage,
      amount:      opportunities.amount,
      probability: opportunities.probability,
      close_date:  opportunities.close_date,
      account_id:  opportunities.account_id,
      accounts: {
        id:   accounts.id,
        name: accounts.name,
      },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .orderBy(desc(opportunities.created_at)),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(tags.name),
    tagConditions.length > 0
      ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
          .from(taggables).where(and(
            eq(taggables.object_type, 'opportunity'),
            inArray(taggables.tag_id, tagConditions.map((c) => c.value)),
          ))
      : Promise.resolve([]),
  ])

  const taggedIdsByTagId = new Map<string, Set<string>>()
  for (const t of taggableRows) {
    if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
    taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
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
    {
      value: 'tag', label: 'タグ', type: 'select',
      options: allTags.map((t) => ({ value: t.id, label: t.name })),
    },
  ]

  let opportunitiesList = applyFilters(raw as Record<string, unknown>[], otherConditions)
  opportunitiesList     = applyTagFilter(opportunitiesList, tagConditions, taggedIdsByTagId)
  const sortRaw         = sp.sort ?? ''
  const sorted          = applySort(opportunitiesList as Record<string, unknown>[], parseSortParams(sortRaw))
  const hasFilter       = conditions.length > 0
  const totalCount      = sorted.length
  const totalPages      = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList     = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
            csvFormat="ID,商談名,ステージ,金額,完了予定日,確度(%),取引先名,説明"
            fieldOptions={{
              'ステージ': ['見込み', '要件確認', '提案', '交渉', '受注', '失注'],
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
                const o = rec as typeof raw[0]
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
