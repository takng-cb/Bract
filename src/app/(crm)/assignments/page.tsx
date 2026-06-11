/**
 * /assignments 一覧 — staffing 業種専用 (Issue #69 Phase 1)
 *
 * リスト（フィルター・グルーピング・ソート対応 REQ-0039）と
 * 月間カレンダー（業務日ベース）のビュー切替を持つ。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts } from '@/lib/schema'
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { assignmentStatusColor, ASSIGNMENT_STATUSES } from '@/industries/staffing/lib/staffingService'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, applyFilters, buildWhere, unresolvedConditions,
  type FilterColumnResolver,
} from '@/lib/filterUtils'
import { parseSortParams, applySort, buildOrderBy } from '@/lib/sortUtils'
import AssignmentsTableView from '@/components/tableviews/AssignmentsTableView'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MonthCalendar, { type CalendarEvent } from '@/components/MonthCalendar'
import { List as ListIcon, CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FILTER_RESOLVER: FilterColumnResolver = {
  title:            { col: assignments.title,            type: 'text' },
  assignment_no:    { col: assignments.assignment_no,    type: 'text' },
  'client.name':    { col: accounts.name,                type: 'text' },
  service_type:     { col: assignments.service_type,     type: 'text' },
  service_location: { col: assignments.service_location, type: 'text' },
  status:           { col: assignments.status,           type: 'select' },
  service_date:     { col: assignments.service_date,     type: 'date' },
  client_total_fee: { col: assignments.client_total_fee, type: 'number' },
}

const FIELDS: FieldDef[] = [
  { value: 'title',            label: '案件名',   type: 'text' },
  { value: 'assignment_no',    label: '案件No',   type: 'text' },
  { value: 'client.name',      label: '派遣先',   type: 'text' },
  { value: 'service_type',     label: '業務区分', type: 'text' },
  { value: 'service_location', label: '場所',     type: 'text' },
  {
    value: 'status', label: '状態', type: 'select',
    options: ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: s })),
  },
  { value: 'service_date',     label: '業務日',       type: 'date' },
  { value: 'client_total_fee', label: '請求総額（円）', type: 'number' },
]

/** ビュー切替（リスト / カレンダー）。f パラメータは保持する */
function ViewToggle({ view, filterRaw }: { view: 'list' | 'calendar'; filterRaw: string[] }) {
  const href = (v: 'list' | 'calendar') => {
    const params = new URLSearchParams()
    params.set('view', v)
    filterRaw.forEach((f) => params.append('f', f))
    return `/assignments?${params.toString()}`
  }
  const base = 'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap'
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
      <Link href={href('list')} title="リスト" className={`${base} ${view === 'list' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
        <ListIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">リスト</span>
      </Link>
      <Link href={href('calendar')} title="カレンダー" className={`${base} ${view === 'calendar' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'}`}>
        <CalendarDays className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">カレンダー</span>
      </Link>
    </div>
  )
}

export default async function AssignmentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string; sort?: string; view?: string; month?: string }>
}) {
  await requireBookRead('assignments')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('staffing'))) notFound()

  const sp = await searchParams
  const view: 'list' | 'calendar' = sp.view === 'calendar' ? 'calendar' : 'list'
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)
  const groupBy = (sp.group ?? '').split(',').filter(Boolean)
  const sortRaw = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const useJsFallback = unresolvedConditions(conditions, FILTER_RESOLVER).length > 0
  const userWhere = useJsFallback ? undefined : buildWhere(conditions, FILTER_RESOLVER)

  // カレンダー表示月（YYYY-MM。不正/未指定は当月）
  const now = new Date()
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
  const calYear  = monthMatch ? Number(monthMatch[1]) : now.getFullYear()
  const calMonth = monthMatch ? Number(monthMatch[2]) : now.getMonth() + 1
  const monthStart = `${calYear}-${String(calMonth).padStart(2, '0')}-01`
  const monthEnd   = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(new Date(calYear, calMonth, 0).getDate()).padStart(2, '0')}`
  // カレンダーは表示月で絞り込み（フィルタ条件も併用）
  const calendarWhere = view === 'calendar'
    ? and(userWhere, gte(assignments.service_date, monthStart), lte(assignments.service_date, monthEnd))
    : userWhere

  const orderBy = buildOrderBy(sortDefs, FILTER_RESOLVER)
  const finalOrderBy = orderBy.length > 0 ? orderBy : [desc(assignments.service_date), desc(assignments.created_at)]

  const [rawRows, edit] = await Promise.all([
    db.select({
      id:                 assignments.id,
      assignment_no:      assignments.assignment_no,
      title:              assignments.title,
      service_date:       assignments.service_date,
      service_location:   assignments.service_location,
      service_type:       assignments.service_type,
      staff_count_required: assignments.staff_count_required,
      status:             assignments.status,
      client_total_fee:   assignments.client_total_fee,
      client:             { id: accounts.id, name: accounts.name },
      assigned_count:     sql<number>`(SELECT COUNT(*)::int FROM ${assignment_staff} WHERE ${assignment_staff.assignment_id} = ${assignments.id})`,
    })
      .from(assignments)
      .leftJoin(accounts, eq(assignments.client_account_id, accounts.id))
      .where(calendarWhere)
      .orderBy(...finalOrderBy),
    canEdit(),
  ])

  // resolver で解決できない条件は JS フォールバック（既存リストと同じ方針）
  let rows = rawRows
  if (useJsFallback) {
    rows = applyFilters(rawRows as unknown as Record<string, unknown>[], conditions) as unknown as typeof rawRows
    rows = applySort(rows as unknown as Record<string, unknown>[], sortDefs) as unknown as typeof rawRows
  }

  const hasFilter = conditions.length > 0
  const isGrouped = groupBy.length > 0

  const calendarEvents: CalendarEvent[] = rows
    .filter((r) => r.service_date)
    .map((r) => ({
      date: String(r.service_date),
      href: `/assignments/${r.id}`,
      label: `${r.title ?? r.assignment_no}（${r.assigned_count}/${r.staff_count_required ?? '—'}）`,
      className: assignmentStatusColor(r.status),
      details: [
        { label: '状態', value: r.status },
        { label: '派遣先', value: r.client?.name ?? '—' },
        { label: '業務日', value: String(r.service_date) },
        { label: 'アサイン', value: `${r.assigned_count} / ${r.staff_count_required ?? '—'} 名` },
        ...(r.service_location ? [{ label: '場所', value: r.service_location }] : []),
        ...(r.client_total_fee ? [{ label: '請求総額', value: `¥${Number(r.client_total_fee).toLocaleString()}` }] : []),
      ],
    }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="📋" className="w-6 h-6" /> 案件</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {view === 'calendar' ? `${calYear}年${calMonth}月 ${rows.length} 件` : `全 ${rows.length} 件`}
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && view === 'list' && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle view={view} filterRaw={filterRaw} />
          {edit && (
            <Link href="/assignments/new" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 whitespace-nowrap">
              ＋ 新規追加
            </Link>
          )}
        </div>
      </div>

      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/assignments"
        groupableFields={view === 'list' ? FIELDS.map((f) => ({ key: f.value, label: f.label })) : []}
        initialGroup={view === 'list' ? (sp.group ?? '') : ''}
        persistParams={view === 'calendar' ? { view: 'calendar', ...(sp.month ? { month: sp.month } : {}) } : {}}
      />

      {view === 'calendar' ? (
        <MonthCalendar
          year={calYear}
          month={calMonth}
          events={calendarEvents}
          basePath="/assignments"
          persistParams={{ view: 'calendar', f: filterRaw }}
        />
      ) : rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="📋" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">{hasFilter ? '条件に一致する案件がありません' : '案件がまだ登録されていません'}</p>
          {hasFilter && <Link href="/assignments" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>}
        </div>
      ) : (
        <TableErrorBoundary>
          <AssignmentsTableView
            records={rows as unknown as Record<string, unknown>[]}
            groupBy={groupBy}
            fields={FIELDS}
            currentSortStr={sortRaw}
          />
        </TableErrorBoundary>
      )}
    </div>
  )
}
