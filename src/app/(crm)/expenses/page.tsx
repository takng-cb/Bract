import { db } from '@/lib/db'
import { expenses, accounts, opportunities } from '@/lib/schema'
import { desc, eq, gte, lte, and, count, sum } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, applyFilters,
  buildWhere, unresolvedConditions,
  type FilterColumnResolver,
} from '@/lib/filterUtils'
import { parseSortParams, applySort, buildOrderBy } from '@/lib/sortUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import ExpensesTableView from '@/components/tableviews/ExpensesTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { lastOfMonth } from '@/lib/dateUtils'

const PAGE_SIZE = 20

const CATEGORY_COLORS: Record<string, string> = {
  交通費:   'bg-blue-50 text-blue-700',
  接待費:   'bg-purple-50 text-purple-700',
  通信費:   'bg-cyan-50 text-cyan-700',
  消耗品費: 'bg-yellow-50 text-yellow-700',
  広告費:   'bg-orange-50 text-orange-700',
  外注費:   'bg-red-50 text-red-700',
  その他:   'bg-zinc-100 text-zinc-600',
}

const FIELDS: FieldDef[] = [
  { value: 'title',               label: '件名',    type: 'text' },
  { value: 'accounts.name',       label: '取引先',  type: 'text' },
  { value: 'opportunities.name',  label: '商談',    type: 'text' },
  {
    value: 'category', label: 'カテゴリ', type: 'select',
    options: [
      { value: '交通費',   label: '交通費' },
      { value: '接待費',   label: '接待費' },
      { value: '通信費',   label: '通信費' },
      { value: '消耗品費', label: '消耗品費' },
      { value: '広告費',   label: '広告費' },
      { value: '外注費',   label: '外注費' },
      { value: 'その他',   label: 'その他' },
    ],
  },
  { value: 'amount',       label: '金額（円）', type: 'number' },
  { value: 'expense_date', label: '日付',       type: 'date' },
]

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from_year?: string; from_month?: string; to_year?: string; to_month?: string; f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  const [sp, edit, colConfig, userId] = await Promise.all([searchParams, canEdit(), getListViewColumns('expenses'), getCurrentUserId()])
  const now = new Date()

  const fromYear  = Number(sp.from_year  ?? now.getFullYear())
  const fromMonth = Number(sp.from_month ?? now.getMonth() + 1)
  const toYear    = Number(sp.to_year    ?? now.getFullYear())
  const toMonth   = Number(sp.to_month   ?? now.getMonth() + 1)

  const from = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`
  const to   = lastOfMonth(toYear, toMonth)

  const persistParams = {
    from_year: String(fromYear), from_month: String(fromMonth),
    to_year: String(toYear),     to_month: String(toMonth),
  }

  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0
  const conditions = parseFilterParams(filterRaw)

  if (filterRaw.length === 0 && groupBy.length === 0) {
    const dv = await getDefaultView('expenses', userId)
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams(persistParams)
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/expenses?${p.toString()}`)
    }
  }

  const sortRaw  = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const selectShape = {
    id:           expenses.id,
    title:        expenses.title,
    amount:       expenses.amount,
    category:     expenses.category,
    expense_date: expenses.expense_date,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
    opportunities: {
      id:   opportunities.id,
      name: opportunities.name,
    },
  } as const

  const _typeProbe = () => db.select(selectShape)
    .from(expenses)
    .leftJoin(accounts, eq(expenses.account_id, accounts.id))
    .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
  type SelectRow = Awaited<ReturnType<typeof _typeProbe>>[number]

  const resolver: FilterColumnResolver = {
    title:                 { col: expenses.title,        type: 'text' },
    'accounts.name':       { col: accounts.name,         type: 'text' },
    'opportunities.name':  { col: opportunities.name,    type: 'text' },
    category:              { col: expenses.category,     type: 'select' },
    amount:                { col: expenses.amount,       type: 'number' },
    expense_date:          { col: expenses.expense_date, type: 'date' },
  }

  const useJsFallback = unresolvedConditions(conditions, resolver).length > 0
  // 期間条件 (from/to) は SQL/JS 双方で適用
  const dateRangeWhere = and(gte(expenses.expense_date, from), lte(expenses.expense_date, to))!

  let displayList: SelectRow[]
  let totalCount: number
  let total: number       // 期間内の全合計
  let pagedTotal: number  // ページ表示分の合計

  if (useJsFallback) {
    const raw = await _typeProbe()
      .where(dateRangeWhere)
      .orderBy(desc(expenses.expense_date))
    const list = applyFilters(raw as Record<string, unknown>[], conditions) as SelectRow[]
    const sorted = applySort(list as Record<string, unknown>[], sortDefs) as SelectRow[]
    totalCount = sorted.length
    total      = sorted.reduce((s, e) => s + Number(e.amount), 0)
    displayList = isGrouped ? sorted : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    pagedTotal = displayList.reduce((s, e) => s + Number(e.amount), 0)
  } else {
    const userWhere = buildWhere(conditions, resolver)
    const where = userWhere ? and(dateRangeWhere, userWhere) : dateRangeWhere
    const orderBy = buildOrderBy(sortDefs, resolver)
    const finalOrderBy = orderBy.length > 0 ? orderBy : [desc(expenses.expense_date)]

    const baseQuery = db.select(selectShape)
      .from(expenses)
      .leftJoin(accounts, eq(expenses.account_id, accounts.id))
      .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
      .where(where)
      .orderBy(...finalOrderBy)

    const [pageRows, totalRow, sumRow] = await Promise.all([
      isGrouped ? baseQuery : baseQuery.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      db.select({ count: count() })
        .from(expenses)
        .leftJoin(accounts, eq(expenses.account_id, accounts.id))
        .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
        .where(where),
      db.select({ total: sum(expenses.amount) })
        .from(expenses)
        .leftJoin(accounts, eq(expenses.account_id, accounts.id))
        .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
        .where(where),
    ])
    totalCount  = Number(totalRow[0]?.count ?? 0)
    total       = Number(sumRow[0]?.total ?? 0)
    displayList = pageRows
    pagedTotal  = displayList.reduce((s, e) => s + Number(e.amount), 0)
  }

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearOptions  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const periodLabel = fromYear === toYear && fromMonth === toMonth
    ? `${fromYear}年${fromMonth}月`
    : `${fromYear}年${fromMonth}月 〜 ${toYear}年${toMonth}月`

  const clearUrl = `/expenses?${new URLSearchParams(persistParams).toString()}`

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">経費管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {periodLabel} — 全 {totalCount} 件 合計{' '}
            <span className="font-semibold text-zinc-800">¥{total.toLocaleString()}</span>
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/expenses"
            importUrl="/api/import/expenses"
            label="経費"
            csvFormat="ID,件名,金額,カテゴリ,日付,取引先名,商談名,備考"
            fieldOptions={{
              'カテゴリ': ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他'],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      {/* 期間セレクター */}
      <form method="get" className="flex items-center gap-2 mb-3 bg-white border border-zinc-200 rounded-lg px-4 py-3">
        {filterRaw.map((v, i) => (
          <input key={i} type="hidden" name="f" value={v} />
        ))}
        <span className="text-sm text-zinc-500 shrink-0">期間</span>
        <select name="from_year" defaultValue={fromYear}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select name="from_month" defaultValue={fromMonth}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <span className="text-sm text-zinc-400">〜</span>
        <select name="to_year" defaultValue={toYear}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select name="to_month" defaultValue={toMonth}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <button type="submit"
          className="px-3 py-1.5 bg-zinc-700 text-white text-sm rounded-md hover:bg-zinc-600 transition-colors shrink-0">
          適用
        </button>
      </form>

      <SavedViewsPanel
        objectType="expenses"
        basePath="/expenses"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
        persistParams={persistParams}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/expenses"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
        persistParams={persistParams}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">💰</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する経費がありません' : 'この期間の経費がありません'}
          </p>
          {hasFilter && (
            <Link href={clearUrl} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
          )}
          {!hasFilter && (
            <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          )}
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <ExpensesTableView
                records={displayList as Record<string, unknown>[]}
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
                const e = rec as SelectRow
                const account     = e.accounts?.id     ? e.accounts     : null
                const opportunity = e.opportunities?.id ? e.opportunities : null
                const catColor    = CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS['その他']
                return (
                  <Link href={`/expenses/${e.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-zinc-900 text-sm leading-snug">{e.title}</span>
                      <span className="shrink-0 font-bold text-zinc-800 text-sm">¥{Number(e.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{e.category}</span>
                      <span className="text-xs text-zinc-400">{e.expense_date}</span>
                    </div>
                    {(account || opportunity) && (
                      <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-zinc-500">
                        {account && <span>🏢 {account.name}</span>}
                        {opportunity && <span>💼 {opportunity.name}</span>}
                      </div>
                    )}
                  </Link>
                )
              }}
            />
            <div className="bg-zinc-100 rounded-lg px-4 py-3 flex items-center justify-between mt-2">
              <span className="text-sm font-semibold text-zinc-700">小計</span>
              <span className="font-bold text-zinc-900">¥{pagedTotal.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/expenses"
          filterParams={filterRaw}
          extraParams={persistParams}
        />
      )}
    </div>
  )
}
