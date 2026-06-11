/**
 * /staff 一覧 — staffing 業種専用 (Issue #69 Phase 1)
 *
 * フィルター・グルーピング・ソート対応（REQ-0039）。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { staff, accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { STAFF_STATUSES } from '@/industries/staffing/lib/staffingService'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import {
  parseFilterParams, applyFilters, buildWhere, unresolvedConditions,
  type FilterColumnResolver,
} from '@/lib/filterUtils'
import { parseSortParams, applySort, buildOrderBy } from '@/lib/sortUtils'
import StaffTableView from '@/components/tableviews/StaffTableView'
import TableErrorBoundary from '@/components/TableErrorBoundary'

export const dynamic = 'force-dynamic'

const FILTER_RESOLVER: FilterColumnResolver = {
  name:                { col: staff.name,                type: 'text' },
  name_kana:           { col: staff.name_kana,           type: 'text' },
  'belong.name':       { col: accounts.name,             type: 'text' },
  phone:               { col: staff.phone,               type: 'text' },
  email:               { col: staff.email,               type: 'text' },
  status:              { col: staff.status,              type: 'select' },
  default_hourly_rate: { col: staff.default_hourly_rate, type: 'number' },
}

const FIELDS: FieldDef[] = [
  { value: 'name',          label: '氏名',     type: 'text' },
  { value: 'name_kana',     label: 'カナ',     type: 'text' },
  { value: 'belong.name',   label: '所属',     type: 'text' },
  { value: 'phone',         label: '電話',     type: 'text' },
  { value: 'email',         label: 'メール',   type: 'text' },
  {
    value: 'status', label: '状態', type: 'select',
    options: STAFF_STATUSES.map((s) => ({ value: s, label: s })),
  },
  { value: 'default_hourly_rate', label: '標準時給（円）', type: 'number' },
]

export default async function StaffListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string; sort?: string }>
}) {
  await requireBookRead('staff')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('staffing'))) notFound()

  const sp = await searchParams
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)
  const groupBy = (sp.group ?? '').split(',').filter(Boolean)
  const sortRaw = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const useJsFallback = unresolvedConditions(conditions, FILTER_RESOLVER).length > 0
  const where = useJsFallback ? undefined : buildWhere(conditions, FILTER_RESOLVER)
  const orderBy = buildOrderBy(sortDefs, FILTER_RESOLVER)
  const finalOrderBy = orderBy.length > 0 ? orderBy : [asc(staff.status), asc(staff.name)]

  const [rawList, edit] = await Promise.all([
    db.select({
      id:                 staff.id,
      name:               staff.name,
      name_kana:          staff.name_kana,
      gender:             staff.gender,
      phone:              staff.phone,
      email:              staff.email,
      skills:             staff.skills,
      available_areas:    staff.available_areas,
      default_hourly_rate: staff.default_hourly_rate,
      status:             staff.status,
      belong:             { id: accounts.id, name: accounts.name },
    })
      .from(staff)
      .leftJoin(accounts, eq(staff.belong_account_id, accounts.id))
      .where(where)
      .orderBy(...finalOrderBy),
    canEdit(),
  ])

  let staffList = rawList
  if (useJsFallback) {
    staffList = applyFilters(rawList as unknown as Record<string, unknown>[], conditions) as unknown as typeof rawList
    staffList = applySort(staffList as unknown as Record<string, unknown>[], sortDefs) as unknown as typeof rawList
  }

  const hasFilter = conditions.length > 0
  const isGrouped = groupBy.length > 0

  // status 別件数（フィルタ後）
  const statusCount: Record<string, number> = {}
  for (const s of STAFF_STATUSES) statusCount[s] = 0
  for (const s of staffList) statusCount[s.status] = (statusCount[s.status] ?? 0) + 1

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🧑‍💼" className="w-6 h-6" /> スタッフ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {staffList.length} 名 ／
            稼働中 {statusCount['稼働中']} / 一時休止 {statusCount['一時休止']} / 引退 {statusCount['引退']}
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        {edit && (
          <Link href="/staff/new" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 whitespace-nowrap">
            ＋ 新規追加
          </Link>
        )}
      </div>

      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/staff"
        groupableFields={FIELDS.map((f) => ({ key: f.value, label: f.label }))}
        initialGroup={sp.group ?? ''}
      />

      {staffList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="🧑‍💼" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">{hasFilter ? '条件に一致するスタッフがいません' : 'スタッフがまだ登録されていません'}</p>
          {hasFilter
            ? <Link href="/staff" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>}
        </div>
      ) : (
        <TableErrorBoundary>
          <StaffTableView
            records={staffList as unknown as Record<string, unknown>[]}
            groupBy={groupBy}
            fields={FIELDS}
            currentSortStr={sortRaw}
          />
        </TableErrorBoundary>
      )}
    </div>
  )
}
