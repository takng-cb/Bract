import { db } from '@/lib/db'
import { activities, accounts, activity_related_records } from '@/lib/schema'
import { desc, eq, inArray, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
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
import { NavIcon } from '@/lib/navIcon'
import MonthCalendar, { type CalendarEvent } from '@/components/MonthCalendar'
import { List as ListIcon, CalendarDays } from 'lucide-react'
import { requireBookRead } from '@/lib/permissions'

const PAGE_SIZE = 20

type SelectRow = {
  id:          string
  type:        string
  subject:     string
  body:        string | null
  occurred_at: Date | null
  account_id:  string | null
  accounts:    { id: string; name: string } | null
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string; view?: string; month?: string }>
}) {
  await requireBookRead('activities')  // RBAC: Read 権限ガード（ADR-0023）
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('activities', uid) : null)
  const [sp, edit, colConfig, , activityTypes, dv] = await Promise.all([
    searchParams, canEdit(), getListViewColumns('activities'), userIdPromise, getActivityTypes(), dvPromise,
  ])

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

  if (filterRaw.length === 0 && groupBy.length === 0 && !sp.view) {
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/activities?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)
  const sortRaw    = sp.sort ?? ''
  const sortDefs   = parseSortParams(sortRaw)

  // ── ステップ1: 全活動を取得（FK 列に依存しない） ─────────────────────
  const allActivities = await db.select({
    id:          activities.id,
    type:        activities.type,
    subject:     activities.subject,
    body:        activities.body,
    occurred_at: activities.occurred_at,
  }).from(activities).orderBy(desc(activities.occurred_at))

  // ── ステップ2: junction 経由で関連 account を bulk fetch ─────────────
  const allIds = allActivities.map((a) => a.id)
  const relRows = allIds.length === 0
    ? []
    : await db.select({
        activity_id:  activity_related_records.activity_id,
        account_id:   activity_related_records.related_record_id,
        account_name: accounts.name,
      })
        .from(activity_related_records)
        .innerJoin(accounts, eq(accounts.id, activity_related_records.related_record_id))
        .where(and(
          inArray(activity_related_records.activity_id, allIds),
          eq(activity_related_records.related_object_api, 'account'),
        ))

  // activity_id → 関連 account 配列
  const accountsByActivityId = new Map<string, { id: string; name: string }[]>()
  for (const r of relRows) {
    if (!accountsByActivityId.has(r.activity_id)) accountsByActivityId.set(r.activity_id, [])
    accountsByActivityId.get(r.activity_id)!.push({ id: r.account_id, name: r.account_name })
  }

  // ── ステップ3: 表示用 SelectRow を構築 ─────────────────────────────
  // 非グループ時: 1 活動 = 1 行（最初の関連 account を primary として表示）
  // グループ時:   1 活動 × 関連 account 数の行を作って各グループに重複表示
  const rawRows: SelectRow[] = []
  for (const act of allActivities) {
    const rel = accountsByActivityId.get(act.id) ?? []
    if (rel.length === 0) {
      rawRows.push({ ...act, account_id: null, accounts: null })
    } else if (isGrouped) {
      for (const acc of rel) rawRows.push({ ...act, account_id: acc.id, accounts: acc })
    } else {
      rawRows.push({ ...act, account_id: rel[0].id, accounts: rel[0] })
    }
  }

  // ── ステップ4: filter / sort / paginate を全部 JS で実施 ──────────────
  const filtered = applyFilters(rawRows as unknown as Record<string, unknown>[], conditions) as unknown as SelectRow[]
  const sorted   = applySort(filtered as unknown as Record<string, unknown>[], sortDefs) as unknown as SelectRow[]

  let displayList: SelectRow[]
  let totalCount: number
  if (isGrouped) {
    displayList = sorted
    totalCount  = new Set(sorted.map((r) => r.id)).size
  } else {
    totalCount = sorted.length
    displayList = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  // ── カレンダービュー（実施日ベース。REQ-0039）─────────────────────
  if (sp.view === 'calendar') {
    const now = new Date()
    const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
    const calYear  = monthMatch ? Number(monthMatch[1]) : now.getFullYear()
    const calMonth = monthMatch ? Number(monthMatch[2]) : now.getMonth() + 1

    // occurred_at は timestamptz。日本時間の日付に丸めてカレンダーに割り当てる
    const jstDate = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    const events: CalendarEvent[] = sorted
      .filter((a) => a.occurred_at)
      .map((a) => ({
        date: jstDate(new Date(a.occurred_at!)),
        href: `/activities/${a.id}`,
        label: a.subject,
        className: TYPE_CONFIG[a.type]?.color ?? 'bg-zinc-50 text-zinc-700',
        details: [
          { label: '種別', value: TYPE_CONFIG[a.type]?.label ?? a.type },
          { label: '日時', value: new Date(a.occurred_at!).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
          ...(a.accounts ? [{ label: '取引先', value: a.accounts.name }] : []),
          ...(a.body ? [{ label: '内容', value: a.body.length > 60 ? `${a.body.slice(0, 60)}…` : a.body }] : []),
        ],
      }))

    const toggleHref = (v: string) => {
      const p = new URLSearchParams()
      if (v === 'calendar') p.set('view', 'calendar')
      filterRaw.forEach((f) => p.append('f', f))
      const qs = p.toString()
      return qs ? `/activities?${qs}` : '/activities'
    }

    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900">活動履歴</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {calYear}年{calMonth}月（実施日ベース）
              {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
              <Link href={toggleHref('list')} title="リスト" className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md text-zinc-600 whitespace-nowrap">
                <ListIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">リスト</span>
              </Link>
              <Link href={toggleHref('calendar')} title="カレンダー" className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md bg-white text-zinc-900 shadow-xs whitespace-nowrap">
                <CalendarDays className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">カレンダー</span>
              </Link>
            </div>
            {edit && (
              <Link href="/activities/new" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap">
                ＋ 新規作成
              </Link>
            )}
          </div>
        </div>
        <ListViewToolbar
          fields={FIELDS}
          initialFilters={filterRaw}
          basePath="/activities"
          groupableFields={[]}
          initialGroup=""
          persistParams={{ view: 'calendar', ...(sp.month ? { month: sp.month } : {}) }}
        />
        <MonthCalendar
          year={calYear}
          month={calMonth}
          events={events}
          basePath="/activities"
          persistParams={{ view: 'calendar', f: filterRaw }}
        />
      </div>
    )
  }

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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md bg-white text-zinc-900 shadow-xs whitespace-nowrap">
              <ListIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">リスト</span>
            </span>
            <Link
              href={`/activities?view=calendar${filterRaw.map((f) => `&f=${encodeURIComponent(f)}`).join('')}`}
              title="カレンダー"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md text-zinc-600 whitespace-nowrap"
            >
              <CalendarDays className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">カレンダー</span>
            </Link>
          </div>
          <CsvToolbar
            exportUrl="/api/export/activities"
            importUrl="/api/import/activities"
            label="活動履歴"
            csvFormat="ID,実施日時,種別,件名,内容,取引先名,担当者名,商談名"
            fieldOptions={{
              '種別': ['電話', 'メール', '打ち合わせ', 'メモ'],
            }}
            showImport={edit}
            filterFields={[
              { value: 'subject', label: '件名', type: 'text' },
              { value: 'body',    label: '内容', type: 'text' },
              {
                value: 'type', label: '種別', type: 'select',
                options: activityTypes.map((t) => ({ value: t.value, label: t.label })),
              },
              { value: 'occurred_at', label: '実施日', type: 'date' },
            ]}
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
          <div className="flex justify-center mb-4"><NavIcon icon="📋" className="w-12 h-12 text-zinc-300" /></div>
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
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${type.color}`}><NavIcon icon={type.icon} className="w-3.5 h-3.5 shrink-0" />{type.label}</span>
                      <span className="text-xs text-zinc-400">
                        {a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}
                      </span>
                    </div>
                    <p className="font-medium text-zinc-900 text-sm mt-1.5 leading-snug">{a.subject}</p>
                    {a.body && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{a.body}</p>}
                    {account && <p className="text-xs text-zinc-500 mt-1 inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{account.name}</p>}
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
