import { db } from '@/lib/db'
import { opportunities, accounts, taggables } from '@/lib/schema'
import { activeIndustry } from '@/lib/industry'
import { getAllTags } from '@/lib/tagUtils'
import { getAllUsers } from '@/lib/userUtils'
import { desc, eq, and, or, inArray, notInArray, gte, count } from 'drizzle-orm'
import { getSystemSettings } from '@/lib/systemSettings'
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
import { NavIcon } from '@/lib/navIcon'
import OpportunityBoard, { type BoardColumn } from '@/components/OpportunityBoard'
import MonthCalendar, { type CalendarEvent } from '@/components/MonthCalendar'
import { List as ListIcon, Kanban as KanbanIcon, BarChart3, CalendarDays } from 'lucide-react'
import { requireBookRead, recordScope } from '@/lib/permissions'

const PAGE_SIZE = 20

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  prospecting:   { label: '見込み',   color: 'bg-zinc-100 text-zinc-600' },
  qualification: { label: '要件確認', color: 'bg-blue-100 text-blue-700' },
  proposal:      { label: '提案',     color: 'bg-yellow-100 text-yellow-700' },
  negotiation:   { label: '交渉',     color: 'bg-orange-100 text-orange-700' },
  closed_won:    { label: '受注',     color: 'bg-green-100 text-green-700' },
  closed_lost:   { label: '失注',     color: 'bg-red-100 text-red-600' },
}

/** カンバン（パイプライン）用ステージ定義（順序とドット色） */
const BOARD_STAGES: { id: string; label: string; dot: string }[] = [
  { id: 'prospecting',   label: '見込み',   dot: 'bg-zinc-400' },
  { id: 'qualification', label: '要件確認', dot: 'bg-blue-500' },
  { id: 'proposal',      label: '提案',     dot: 'bg-violet-500' },
  { id: 'negotiation',   label: '交渉',     dot: 'bg-amber-500' },
  { id: 'closed_won',    label: '受注',     dot: 'bg-green-500' },
  { id: 'closed_lost',   label: '失注',     dot: 'bg-zinc-400' },
]

/**
 * ビュー切替トグル（パイプライン / リスト）＋予実リンク。
 * モバイルではラベルを隠してアイコンのみ（横幅あふれによるボタン崩れ防止）。
 */
function ViewToggle({ view }: { view: 'board' | 'list' | 'calendar' }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap'
  return (
    <div className="flex items-center gap-2">
      <Link href="/forecast" title="予実" className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold text-zinc-600 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 whitespace-nowrap">
        <BarChart3 className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">予実</span>
      </Link>
      <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
        <Link href="/opportunities?view=board" title="パイプライン" className={`${base} ${view === 'board' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
          <KanbanIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">パイプライン</span>
        </Link>
        <Link href="/opportunities?view=list" title="リスト" className={`${base} ${view === 'list' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
          <ListIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">リスト</span>
        </Link>
        <Link href="/opportunities?view=calendar" title="カレンダー" className={`${base} ${view === 'calendar' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
          <CalendarDays className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">カレンダー</span>
        </Link>
      </div>
    </div>
  )
}

/** フィルタの SQL pushdown 用 resolver（パイプライン / リスト共通） */
const FILTER_RESOLVER: FilterColumnResolver = {
  name:             { col: opportunities.name,        type: 'text' },
  'accounts.name':  { col: accounts.name,             type: 'text' },
  stage:            { col: opportunities.stage,       type: 'select' },
  amount:           { col: opportunities.amount,      type: 'number' },
  probability:      { col: opportunities.probability, type: 'number' },
  close_date:       { col: opportunities.close_date,  type: 'date' },
  owner_id:         { col: opportunities.owner_id,    type: 'select' },
}

/** フィルタ UI のフィールド定義（パイプライン / リスト共通） */
function buildFilterFields(
  allUsers: { id: string; name: string }[],
  allTags: { id: string; name: string }[],
): FieldDef[] {
  return [
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
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string; view?: string; month?: string }>
}) {
  await requireBookRead('opportunities')  // RBAC: Read 権限ガード（ADR-0023）
  // レコードスコープ（REQ-0083）: 'own' なら owner_id = 自分のみ可視。owner_id は実カラムのため
  // SQL の .where() に AND すれば board/list・JS フォールバック双方で一貫して効く。
  const [oppScope, scopeMeId] = await Promise.all([recordScope('opportunities', 'read'), getCurrentUserId()])
  const scopeWhere = oppScope === 'own' && scopeMeId ? eq(opportunities.owner_id, scopeMeId) : undefined
  const sp0 = await searchParams
  const hasListParams = Boolean(sp0.f || sp0.group || sp0.sort || sp0.page)
  // 既定はパイプライン（カンバン）。view 指定が無く一覧操作（フィルタ等）時はリスト。
  const view: 'board' | 'list' | 'calendar' =
    sp0.view === 'calendar' ? 'calendar'
    : sp0.view === 'list' || (sp0.view !== 'board' && hasListParams) ? 'list'
    : 'board'

  if (view === 'board' || view === 'calendar') {
    // ── パイプラインのフィルタ（リストと同じ f パラメータ・SQL pushdown。view=board は persistParams で保持）──
    const filterRaw = [sp0.f].flat().filter(Boolean) as string[]
    const conditions = parseFilterParams(filterRaw)
    const { tagConditions, otherConditions } = splitTagConditions(conditions)
    const useJsFallback = unresolvedConditions(otherConditions, FILTER_RESOLVER).length > 0
    const baseWhere = useJsFallback
      ? undefined
      : and(buildWhere(otherConditions, FILTER_RESOLVER), buildTagWhere(tagConditions, 'opportunity', opportunities.id))

    // 受注/失注は溜まり続けるため、ボードでは直近Nヶ月のみ表示（REQ-0044。0=無制限）
    const TERMINAL_STAGES = ['closed_won', 'closed_lost']
    const windowMonths = view === 'board'
      ? Math.max(0, Number((await getSystemSettings(['board_closed_window_months'])).board_closed_window_months) || 0)
      : 0
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - windowMonths)
    const windowWhere = windowMonths > 0
      ? or(notInArray(opportunities.stage, TERMINAL_STAGES), gte(opportunities.updated_at, cutoff))
      : undefined
    const where = and(baseWhere, useJsFallback ? undefined : windowWhere, scopeWhere)

    const [edit, rawRows, users, allTags, taggableRows, closedTotals] = await Promise.all([
      canEdit(),
      db.select({
        id: opportunities.id, name: opportunities.name, stage: opportunities.stage,
        amount: opportunities.amount, probability: opportunities.probability,
        close_date: opportunities.close_date, owner_id: opportunities.owner_id,
        updated_at: opportunities.updated_at,
        accounts: { id: accounts.id, name: accounts.name },
      })
        .from(opportunities)
        .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
        .where(where)
        .orderBy(desc(opportunities.amount)),
      getAllUsers(),
      getAllTags(),
      useJsFallback && tagConditions.length > 0
        ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
            .from(taggables).where(and(
              eq(taggables.object_type, 'opportunity'),
              inArray(taggables.tag_id, tagConditions.map((c) => c.value)),
            ))
        : Promise.resolve([] as { tag_id: string; object_id: string }[]),
      // ウィンドウ適用前の終端ステージ全件数（「全N件中」表示用）
      windowMonths > 0
        ? db.select({ stage: opportunities.stage, total: count() })
            .from(opportunities)
            .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
            .where(and(baseWhere, inArray(opportunities.stage, TERMINAL_STAGES), scopeWhere))
            .groupBy(opportunities.stage)
        : Promise.resolve([] as { stage: string; total: number }[]),
    ])

    let rows = rawRows
    if (useJsFallback) {
      const taggedIdsByTagId = new Map<string, Set<string>>()
      for (const t of taggableRows) {
        if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
        taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
      }
      rows = applyTagFilter(
        applyFilters(rows as unknown as Record<string, unknown>[], otherConditions) as unknown as typeof rawRows,
        tagConditions, taggedIdsByTagId,
      )
      // JS フォールバック時もウィンドウを適用
      if (windowMonths > 0) {
        rows = rows.filter((r) =>
          !TERMINAL_STAGES.includes(r.stage) || (r.updated_at && new Date(r.updated_at) >= cutoff))
      }
    }

    const closedTotalByStage = new Map(closedTotals.map((t) => [t.stage, Number(t.total)]))
    const ownerName = new Map(users.map((u) => [u.id, u.name]))
    const columns: BoardColumn[] = BOARD_STAGES.map((s) => {
      const deals = rows
        .filter((r) => r.stage === s.id)
        .map((r) => ({
          id: r.id, name: r.name, accountName: r.accounts?.name ?? null,
          amount: r.amount != null ? Number(r.amount) : null,
          probability: r.probability != null ? Number(r.probability) : null,
          ownerChar: (r.owner_id && ownerName.get(r.owner_id)?.trim()?.[0]) || '—',
          closeDate: r.close_date ?? null,
        }))
      const sum = deals.reduce((acc, d) => acc + (d.amount ?? 0), 0)
      const isTerminal = TERMINAL_STAGES.includes(s.id)
      return {
        id: s.id, label: s.label, dot: s.dot, deals, sum,
        ...(windowMonths > 0 && isTerminal
          ? {
              windowNote: `直近${windowMonths}ヶ月 ・ 全${closedTotalByStage.get(s.id) ?? deals.length}件中${deals.length}件`,
              moreHref: `/opportunities?view=list&f=${encodeURIComponent(`stage|eq|${s.id}`)}`,
            }
          : {}),
      }
    })
    const total = rows.length
    const weighted = rows.reduce((acc, r) => acc + (r.amount != null && r.probability != null ? Number(r.amount) * Number(r.probability) / 100 : 0), 0)
    const hasFilter = conditions.length > 0

    // カレンダービュー（完了予定日ベース。REQ-0039）
    const now = new Date()
    const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp0.month ?? '')
    const calYear  = monthMatch ? Number(monthMatch[1]) : now.getFullYear()
    const calMonth = monthMatch ? Number(monthMatch[2]) : now.getMonth() + 1
    const calendarEvents: CalendarEvent[] = view === 'calendar'
      ? rows
          .filter((r) => r.close_date)
          .map((r) => ({
            date: String(r.close_date),
            href: `/opportunities/${r.id}`,
            label: `${r.name}${r.amount != null ? `（¥${Number(r.amount).toLocaleString()}）` : ''}`,
            className: STAGE_LABELS[r.stage]?.color ?? 'bg-zinc-100 text-zinc-600',
            details: [
              { label: 'ステージ', value: STAGE_LABELS[r.stage]?.label ?? r.stage },
              { label: '取引先', value: r.accounts?.name ?? '—' },
              { label: '金額', value: r.amount != null ? `¥${Number(r.amount).toLocaleString()}` : '—' },
              { label: '確度', value: r.probability != null ? `${r.probability}%` : '—' },
              { label: '完了予定', value: String(r.close_date) },
            ],
          }))
      : []

    return (
      <div className="flex flex-col h-full p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900">商談 <span className="ml-1 text-base font-semibold text-zinc-400 tabular-nums">{view === 'calendar' ? `${calYear}年${calMonth}月（完了予定日）` : `${total}件 · 加重 ¥${Math.round(weighted).toLocaleString()}`}</span>
              {hasFilter && <span className="ml-1 text-sm font-semibold text-blue-600">（絞り込み中）</span>}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={view} />
            {edit && (
              <Link href="/opportunities/new" title="商談を作成" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap">
                <NavIcon icon="💼" className="w-4 h-4" /><span className="hidden sm:inline">商談を作成</span><span className="sm:hidden">作成</span>
              </Link>
            )}
          </div>
        </div>
        <ListViewToolbar
          fields={buildFilterFields(users, allTags)}
          initialFilters={filterRaw}
          basePath="/opportunities"
          groupableFields={[]}
          initialGroup=""
          persistParams={{ view, ...(view === 'calendar' && sp0.month ? { month: sp0.month } : {}) }}
        />
        {view === 'calendar' ? (
          <MonthCalendar
            year={calYear}
            month={calMonth}
            events={calendarEvents}
            basePath="/opportunities"
            persistParams={{ view: 'calendar', f: filterRaw }}
          />
        ) : (
          <OpportunityBoard columns={columns} canEdit={edit} />
        )}
      </div>
    )
  }

  // パフォーマンス最適化: getDefaultView を Round 1 と並列化
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('opportunities', uid) : null)
  const [sp, edit, colConfig, _userId, dv] = await Promise.all([
    searchParams, canEdit(), getListViewColumns('opportunities'), userIdPromise, dvPromise,
  ])
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0

  if (filterRaw.length === 0 && groupBy.length === 0) {
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

  // resolver（FILTER_RESOLVER）で解決できないフィルタがある場合のみ JS フォールバック。
  // tag フィルタは buildTagWhere で SQL に押し下げる。
  const useJsFallback = unresolvedConditions(otherConditions, FILTER_RESOLVER).length > 0

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
        .where(scopeWhere)
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
    const userWhere = buildWhere(otherConditions, FILTER_RESOLVER)
    const tagWhere = buildTagWhere(tagConditions, 'opportunity', opportunities.id)
    // and(undefined, x, y) は drizzle が undefined を無視するため安全
    const where = and(userWhere, tagWhere, scopeWhere)
    const orderBy = buildOrderBy(sortDefs, FILTER_RESOLVER)
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

  const FIELDS: FieldDef[] = buildFilterFields(allUsers, allTags)

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  const groupableFields = FIELDS
    .filter((f) => f.value !== 'tag')
    .map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900">商談</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ViewToggle view="list" />
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
            filterFields={[
              { value: 'name',          label: '商談名', type: 'text' },
              { value: 'accounts.name', label: '取引先名', type: 'text' },
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
            ]}
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
          <div className="flex justify-center mb-4"><NavIcon icon="💼" className="w-12 h-12 text-zinc-300" /></div>
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
                    {account && <p className="text-xs text-zinc-500 mt-0.5 inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{account.name}</p>}
                    <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">{o.close_date ? <><NavIcon icon="📅" className="w-3 h-3 shrink-0" /> {o.close_date}</> : '期限なし'}</span>
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
