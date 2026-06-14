import { db } from '@/lib/db'
import { tasks, accounts, opportunities, task_related_records } from '@/lib/schema'
import { asc, desc, eq, inArray, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import { toggleTaskDone } from '@/app/actions/tasks'
import TaskDoneToggle from '@/components/TaskDoneToggle'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import TasksTableView from '@/components/tableviews/TasksTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'
import TableErrorBoundary from '@/components/TableErrorBoundary'
import MobileGroupedCards from '@/components/MobileGroupedCards'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'
import MonthCalendar, { type CalendarEvent } from '@/components/MonthCalendar'
import { List as ListIcon, CalendarDays } from 'lucide-react'

const PAGE_SIZE = 20

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

const FIELDS: FieldDef[] = [
  { value: 'title',         label: 'タイトル', type: 'text' },
  { value: 'description',   label: '詳細',     type: 'text' },
  { value: 'accounts.name', label: '取引先',   type: 'text' },
  {
    value: 'priority', label: '優先度', type: 'select',
    options: [
      { value: 'high',   label: '高' },
      { value: 'medium', label: '中' },
      { value: 'low',    label: '低' },
    ],
  },
  {
    value: 'done', label: '完了状態', type: 'select',
    options: [
      { value: 'false', label: '未完了' },
      { value: 'true',  label: '完了済み' },
    ],
  },
  { value: 'due_date', label: '期限日', type: 'date' },
]

type SelectRow = {
  id:          string
  title:       string
  description: string | null
  done:        boolean
  priority:    string
  due_date:    string | null
  owner_id:    string | null
  owner_name:  string | null
  account_id:  string | null
  accounts:      { id: string; name: string } | null
  opportunities: { id: string; name: string } | null
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string; view?: string; month?: string }>
}) {
  await requireBookRead('tasks')  // RBAC: Read 権限ガード（ADR-0023）
  const userIdPromise = getCurrentUserId()
  const dvPromise     = userIdPromise.then((uid) => uid ? getDefaultView('tasks', uid) : null)
  const [sp, edit, colConfig, , dv] = await Promise.all([
    searchParams, canEdit(), getListViewColumns('tasks'), userIdPromise, dvPromise,
  ])
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
      redirect(`/tasks?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)
  const sortRaw  = sp.sort ?? ''
  const sortDefs = parseSortParams(sortRaw)

  const today = new Date().toISOString().slice(0, 10)

  // ── ステップ1: 全タスクを取得（FK 列に依存しない） ─────────────────────
  const allTasks = await db.select({
    id:          tasks.id,
    title:       tasks.title,
    description: tasks.description,
    done:        tasks.done,
    priority:    tasks.priority,
    due_date:    tasks.due_date,
    owner_id:    tasks.owner_id,
  }).from(tasks).orderBy(asc(tasks.done), asc(tasks.due_date), desc(tasks.created_at))

  // ── ステップ2: junction 経由で関連 account / opportunity を bulk fetch ─
  const allIds = allTasks.map((t) => t.id)
  const [accRelRows, oppRelRows] = await Promise.all([
    allIds.length === 0 ? Promise.resolve([]) : db.select({
      task_id:      task_related_records.task_id,
      account_id:   task_related_records.related_record_id,
      account_name: accounts.name,
    })
      .from(task_related_records)
      .innerJoin(accounts, eq(accounts.id, task_related_records.related_record_id))
      .where(and(
        inArray(task_related_records.task_id, allIds),
        eq(task_related_records.related_object_api, 'account'),
      )),
    allIds.length === 0 ? Promise.resolve([]) : db.select({
      task_id:          task_related_records.task_id,
      opportunity_id:   task_related_records.related_record_id,
      opportunity_name: opportunities.name,
    })
      .from(task_related_records)
      .innerJoin(opportunities, eq(opportunities.id, task_related_records.related_record_id))
      .where(and(
        inArray(task_related_records.task_id, allIds),
        eq(task_related_records.related_object_api, 'opportunity'),
      )),
  ])

  const accountsByTaskId = new Map<string, { id: string; name: string }[]>()
  for (const r of accRelRows) {
    if (!accountsByTaskId.has(r.task_id)) accountsByTaskId.set(r.task_id, [])
    accountsByTaskId.get(r.task_id)!.push({ id: r.account_id, name: r.account_name })
  }
  const opportunitiesByTaskId = new Map<string, { id: string; name: string }[]>()
  for (const r of oppRelRows) {
    if (!opportunitiesByTaskId.has(r.task_id)) opportunitiesByTaskId.set(r.task_id, [])
    opportunitiesByTaskId.get(r.task_id)!.push({ id: r.opportunity_id, name: r.opportunity_name })
  }

  // 担当者名を resolve するため users を取得
  const allUsers = await getAllUsers()
  const userNameById = new Map(allUsers.map((u) => [u.id, u.name]))

  // ── ステップ3: 表示用 SelectRow を構築 ─────────────────────────────
  const rawRows: SelectRow[] = []
  for (const t of allTasks) {
    const accs = accountsByTaskId.get(t.id) ?? []
    const opps = opportunitiesByTaskId.get(t.id) ?? []
    const owner_name = t.owner_id ? (userNameById.get(t.owner_id) ?? null) : null
    if (isGrouped && accs.length > 1) {
      // グループ時のみ account ごとに行を duplicate
      for (const acc of accs) {
        rawRows.push({
          ...t,
          owner_name,
          account_id:    acc.id,
          accounts:      acc,
          opportunities: opps[0] ?? null,
        })
      }
    } else {
      // 非グループ時 or 関連 account が 0/1 個: 1 行
      rawRows.push({
        ...t,
        owner_name,
        account_id:    accs[0]?.id ?? null,
        accounts:      accs[0] ?? null,
        opportunities: opps[0] ?? null,
      })
    }
  }

  // ── ステップ4: filter / sort / paginate を全部 JS で実施 ──────────────
  const filtered = applyFilters(rawRows as unknown as Record<string, unknown>[], conditions) as unknown as SelectRow[]
  const sorted   = applySort(filtered as unknown as Record<string, unknown>[], sortDefs) as unknown as SelectRow[]

  let displayList: SelectRow[]
  let totalCount: number
  let undoneCount: number
  if (isGrouped) {
    displayList = sorted
    const uniqueIds = new Set(sorted.map((r) => r.id))
    totalCount  = uniqueIds.size
    // undone は unique id ベース
    const undoneIds = new Set(sorted.filter((r) => !r.done).map((r) => r.id))
    undoneCount = undoneIds.size
  } else {
    totalCount  = sorted.length
    undoneCount = sorted.filter((r) => !r.done).length
    displayList = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }

  const hasFilter  = conditions.length > 0
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)

  const pending = displayList.filter((t) => !t.done)
  const done    = displayList.filter((t) =>  t.done)

  async function toggleDone(formData: FormData) {
    'use server'
    const id   = formData.get('id') as string
    const doneVal = formData.get('done') === 'true'
    await toggleTaskDone(id, doneVal, '/tasks')
  }

  const groupableFields = FIELDS
    .filter((f) => f.value !== 'done')
    .map((f) => ({ key: f.value, label: f.label }))

  // ── カレンダービュー（期限日ベース。REQ-0039）─────────────────────
  const view: 'list' | 'calendar' = sp.view === 'calendar' ? 'calendar' : 'list'
  if (view === 'calendar') {
    const now = new Date()
    const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
    const calYear  = monthMatch ? Number(monthMatch[1]) : now.getFullYear()
    const calMonth = monthMatch ? Number(monthMatch[2]) : now.getMonth() + 1

    const events: CalendarEvent[] = sorted
      .filter((t) => t.due_date)
      .map((t) => ({
        date: String(t.due_date),
        href: `/tasks/${t.id}`,
        label: t.title,
        className: t.done
          ? 'bg-zinc-100 text-zinc-400 line-through'
          : String(t.due_date) < today
          ? 'bg-red-50 text-red-600'
          : PRIORITY_CONFIG[t.priority]?.color ?? 'bg-blue-50 text-blue-700',
        details: [
          { label: '状態', value: t.done ? '完了' : String(t.due_date) < today ? '未完了（期限超過）' : '未完了' },
          { label: '期限', value: String(t.due_date) },
          { label: '優先度', value: PRIORITY_CONFIG[t.priority]?.label ?? t.priority },
          ...(t.owner_name ? [{ label: '担当', value: t.owner_name }] : []),
          ...(t.accounts ? [{ label: '取引先', value: t.accounts.name }] : []),
        ],
      }))

    const calToggleHref = (v: string) => {
      const p = new URLSearchParams()
      if (v === 'calendar') p.set('view', 'calendar')
      filterRaw.forEach((f) => p.append('f', f))
      const qs = p.toString()
      return qs ? `/tasks?${qs}` : '/tasks'
    }

    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900">ToDo</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {calYear}年{calMonth}月（期限日ベース）
              {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
              <Link href={calToggleHref('list')} title="リスト" className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md text-zinc-600 whitespace-nowrap">
                <ListIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">リスト</span>
              </Link>
              <Link href={calToggleHref('calendar')} title="カレンダー" className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md bg-white text-zinc-900 shadow-xs whitespace-nowrap">
                <CalendarDays className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">カレンダー</span>
              </Link>
            </div>
            {edit && (
              <Link href="/tasks/new" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap">
                ＋ 新規作成
              </Link>
            )}
          </div>
        </div>
        <ListViewToolbar
          fields={FIELDS}
          initialFilters={filterRaw}
          basePath="/tasks"
          groupableFields={[]}
          initialGroup=""
          persistParams={{ view: 'calendar', ...(sp.month ? { month: sp.month } : {}) }}
        />
        <MonthCalendar
          year={calYear}
          month={calMonth}
          events={events}
          basePath="/tasks"
          persistParams={{ view: 'calendar', f: filterRaw }}
        />
      </div>
    )
  }

  const TaskTable = ({ rows, label }: { rows: SelectRow[]; label: string }) => (
    <div>
      {/* PC: テーブル */}
      <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label} ({rows.length})</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-400 text-center">すべて完了しています</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100">
              <tr>
                <th className="w-10 px-4 py-2"></th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">タイトル</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">優先度</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">期限日</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">取引先</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">商談</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((task) => {
                const account     = task.accounts?.id     ? task.accounts     : null
                const opportunity = task.opportunities?.id ? task.opportunities : null
                const priority    = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
                const isOverdue   = !task.done && task.due_date && task.due_date < today
                return (
                  <tr key={task.id} className={`hover:bg-zinc-50 transition-colors ${task.done ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <TaskDoneToggle taskId={task.id} done={task.done} action={toggleDone} className="mx-auto" />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/tasks/${task.id}`} className={`hover:text-blue-600 ${task.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{task.title}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.due_date
                        ? <span className={`text-sm ${isOverdue ? 'text-red-500 font-medium' : 'text-zinc-500'}`}>{new Date(task.due_date).toLocaleDateString('ja-JP')}{isOverdue && <span className="ml-1 text-xs">(超過)</span>}</span>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {account ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">{account.name}</Link> : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {opportunity ? <Link href={`/opportunities/${opportunity.id}`} className="hover:text-blue-600 text-xs">{opportunity.name}</Link> : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/tasks/${task.id}/edit`} className="text-xs text-zinc-400 hover:text-zinc-700">編集</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* モバイル: カード */}
      <div className="md:hidden">
        <div className="px-1 py-2 mb-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label} ({rows.length})</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6 bg-white rounded-lg border border-zinc-200">すべて完了しています</p>
        ) : (
          <div className="space-y-2">
            {rows.map((task) => {
              const account     = task.accounts?.id     ? task.accounts     : null
              const opportunity = task.opportunities?.id ? task.opportunities : null
              const priority    = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue   = !task.done && task.due_date && task.due_date < today
              return (
                <div key={task.id} className={`bg-white rounded-lg border border-zinc-200 px-4 py-3 flex gap-3 ${task.done ? 'opacity-60' : ''}`}>
                  <div className="pt-0.5 shrink-0">
                    <TaskDoneToggle taskId={task.id} done={task.done} action={toggleDone} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/tasks/${task.id}`} className={`font-medium text-sm leading-snug ${task.done ? 'line-through text-zinc-400' : 'text-zinc-900 hover:text-blue-600'}`}>
                        {task.title}
                      </Link>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-zinc-500">
                      {task.due_date && (
                        <span className={`inline-flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                          <NavIcon icon="📅" className="w-3 h-3 shrink-0" /> {new Date(task.due_date).toLocaleDateString('ja-JP')}{isOverdue ? ' (超過)' : ''}
                        </span>
                      )}
                      {account && <span className="inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{account.name}</span>}
                      {opportunity && <span className="inline-flex items-center gap-1"><NavIcon icon="💼" className="w-3 h-3 shrink-0" />{opportunity.name}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">ToDo</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件（未完了 {undoneCount} 件）
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md bg-white text-zinc-900 shadow-xs whitespace-nowrap">
              <ListIcon className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">リスト</span>
            </span>
            <Link
              href={`/tasks?view=calendar${filterRaw.map((f) => `&f=${encodeURIComponent(f)}`).join('')}`}
              title="カレンダー"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-semibold rounded-md text-zinc-600 whitespace-nowrap"
            >
              <CalendarDays className="w-4 h-4" strokeWidth={2.25} aria-hidden /><span className="hidden sm:inline">カレンダー</span>
            </Link>
          </div>
          <CsvToolbar
            exportUrl="/api/export/tasks"
            importUrl="/api/import/tasks"
            label="タスク"
            csvFormat="ID,タイトル,期日,優先度,完了,取引先名,担当者名,商談名"
            fieldOptions={{
              '優先度': ['高', '中', '低'],
              '完了': ['完了（済みの場合）', '空（未完了の場合）'],
            }}
            showImport={edit}
            filterFields={[
              { value: 'title', label: 'タイトル', type: 'text' },
              {
                value: 'priority', label: '優先度', type: 'select',
                options: [
                  { value: 'high',   label: '高' },
                  { value: 'medium', label: '中' },
                  { value: 'low',    label: '低' },
                ],
              },
              {
                value: 'done', label: '完了状態', type: 'select',
                options: [
                  { value: 'false', label: '未完了' },
                  { value: 'true',  label: '完了済み' },
                ],
              },
              { value: 'due_date', label: '期日', type: 'date' },
            ]}
          />
          {edit && (
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      <SavedViewsPanel
        objectType="tasks"
        basePath="/tasks"
        currentFilterRaw={filterRaw}
        currentGroup={sp.group ?? ''}
        currentSort={sortRaw}
      />
      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/tasks"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="✅" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致するToDoがありません' : 'ToDoがありません'}
          </p>
          {hasFilter
            ? <Link href="/tasks" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : isGrouped ? (
        <>
          <div className="hidden md:block">
            <TableErrorBoundary>
              <TasksTableView
                records={displayList as unknown as Record<string, unknown>[]}
                groupBy={groupBy}
                fields={FIELDS}
                activeKeys={colConfig}
                currentSortStr={sortRaw}
              />
            </TableErrorBoundary>
          </div>
          <div className="md:hidden">
            <MobileGroupedCards
              records={displayList as unknown as Record<string, unknown>[]}
              groupBy={groupBy}
              fields={FIELDS}
              renderCard={(rec) => {
                const task = rec as SelectRow
                const account     = task.accounts?.id     ? task.accounts     : null
                const opportunity = task.opportunities?.id ? task.opportunities : null
                const priority    = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
                const isOverdue   = !task.done && task.due_date && task.due_date < today
                return (
                  <div className={`bg-white rounded-lg border border-zinc-200 px-4 py-3 flex gap-3 ${task.done ? 'opacity-60' : ''}`}>
                    <div className="pt-0.5 shrink-0">
                      <TaskDoneToggle taskId={task.id} done={task.done} action={toggleDone} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/tasks/${task.id}`} className={`font-medium text-sm leading-snug ${task.done ? 'line-through text-zinc-400' : 'text-zinc-900 hover:text-blue-600'}`}>
                          {task.title}
                        </Link>
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-zinc-500">
                        {task.due_date && (
                          <span className={`inline-flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                            <NavIcon icon="📅" className="w-3 h-3 shrink-0" /> {new Date(task.due_date).toLocaleDateString('ja-JP')}{isOverdue ? ' (超過)' : ''}
                          </span>
                        )}
                        {account && <span className="inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{account.name}</span>}
                        {opportunity && <span className="inline-flex items-center gap-1"><NavIcon icon="💼" className="w-3 h-3 shrink-0" />{opportunity.name}</span>}
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {TaskTable({ rows: pending, label: '未完了' })}
          {done.length > 0 && TaskTable({ rows: done, label: '完了済み' })}
        </div>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/tasks" filterParams={filterRaw} />
      )}
    </div>
  )
}
