import { db } from '@/lib/db'
import { activities, accounts } from '@/lib/schema'
import { desc, eq, count } from 'drizzle-orm'
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
import ActivitiesTableView from '@/components/tableviews/ActivitiesTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { getActivityTypes } from '@/lib/activityTypes'

const PAGE_SIZE = 20

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  // パフォーマンス最適化: getDefaultView を Round 1 と並列化
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('activities', uid) : null)
  const [sp, edit, colConfig, userId, activityTypes, dv] = await Promise.all([
    searchParams, canEdit(), getListViewColumns('activities'), userIdPromise, getActivityTypes(), dvPromise,
  ])

  // 動的活動種別から FilterBuilder の field 定義と TYPE_CONFIG を生成
  const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {}
  for (const t of activityTypes) {
    TYPE_CONFIG[t.value] = {
      label: t.label,
      icon: t.icon,
      color: t.color ?? 'bg-zinc-50 text-zinc-700',
    }
  }
  const FIELDS: FieldDef[] = [
    { value: 'subject',       label: '件名',    type: 'text' },
    { value: 'body',          label: '内容',    type: 'text' },
    { value: 'accounts.name', label: '取引先',  type: 'text' },
    {
      value: 'type', label: '種別', type: 'select',
      options: activityTypes.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` })),
    },
    { value: 'occurred_at', label: '実施日', type: 'date' },
  ]
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
      redirect(`/activities?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)
  const sortRaw  = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const selectShape = {
    id:          activities.id,
    type:        activities.type,
    subject:     activities.subject,
    body:        activities.body,
    occurred_at: activities.occurred_at,
    account_id:  activities.account_id,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
  } as const

  const _typeProbe = () => db.select(selectShape)
    .from(activities)
    .leftJoin(accounts, eq(activities.account_id, accounts.id))
  type SelectRow = Awaited<ReturnType<typeof _typeProbe>>[number]

  const resolver: FilterColumnResolver = {
    subject:         { col: activities.subject,     type: 'text' },
    body:            { col: activities.body,        type: 'text' },
    'accounts.name': { col: accounts.name,          type: 'text' },
    type:            { col: activities.type,        type: 'select' },
    occurred_at:     { col: activities.occurred_at, type: 'date' },
  }

  const useJsFallback = unresolvedConditions(conditions, resolver).length > 0

  let displayList: SelectRow[]
  let totalCount: number

  if (useJsFallback) {
    const raw = await _typeProbe().orderBy(desc(activities.occurred_at))
    const list = applyFilters(raw as Record<string, unknown>[], conditions) as SelectRow[]
    const sorted = applySort(list as Record<string, unknown>[], sortDefs) as SelectRow[]
    totalCount = sorted.length
    displayList = isGrouped ? sorted : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  } else {
    const where = buildWhere(conditions, resolver)
    const orderBy = buildOrderBy(sortDefs, resolver)
    const finalOrderBy = orderBy.length > 0 ? orderBy : [desc(activities.occurred_at)]

    const baseQuery = db.select(selectShape)
      .from(activities)
      .leftJoin(accounts, eq(activities.account_id, accounts.id))
      .where(where)
      .orderBy(...finalOrderBy)

    const [pageRows, totalRow] = await Promise.all([
      isGrouped ? baseQuery : baseQuery.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      db.select({ count: count() })
        .from(activities)
        .leftJoin(accounts, eq(activities.account_id, accounts.id))
        .where(where),
    ])
    totalCount = Number(totalRow[0]?.count ?? 0)
    displayList = pageRows
  }

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">活動履歴</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/activities"
            importUrl="/api/import/activities"
            label="活動履歴"
            csvFormat="ID,実施日時,種別,件名,内容,取引先名,担当者名,商談名"
            fieldOptions={{
              '種別': ['電話', 'メール', '打ち合わせ', 'メモ'],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/activities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      <SavedViewsPanel
        objectType="activities"
        basePath="/activities"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/activities"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する活動履歴がありません' : '活動履歴がまだありません'}
          </p>
          {hasFilter
            ? <Link href="/activities" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <TableErrorBoundary>
              <ActivitiesTableView
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
                const type    = TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                const account = a.accounts?.id ? a.accounts : null
                return (
                  <Link href={`/activities/${a.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${type.color}`}>{type.icon} {type.label}</span>
                      <span className="text-xs text-zinc-400">
                        {a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}
                      </span>
                    </div>
                    <p className="font-medium text-zinc-900 text-sm mt-1.5 leading-snug">{a.subject}</p>
                    {a.body && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{a.body}</p>}
                    {account && <p className="text-xs text-zinc-500 mt-1">🏢 {account.name}</p>}
                  </Link>
                )
              }}
            />
          </div>
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/activities" filterParams={filterRaw} />
      )}
    </div>
  )
}
