import { db } from '@/lib/db'
import { tasks, accounts, opportunities } from '@/lib/schema'
import { asc, desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import { toggleTaskDone } from '@/app/actions/tasks'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import { getDefaultView } from '@/lib/savedViews'
import TasksTableView from '@/components/tableviews/TasksTableView'
import SavedViewsPanel from '@/components/SavedViewsPanel'

const PAGE_SIZE = 20

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

const FIELDS: FieldDef[] = [
  { value: 'title',         label: 'タイトル', type: 'text' },
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

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  const [sp, edit, colConfig, userId] = await Promise.all([searchParams, canEdit(), getListViewColumns('tasks'), getCurrentUserId()])
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0

  if (filterRaw.length === 0 && groupBy.length === 0) {
    const dv = await getDefaultView('tasks', userId)
    if (dv && (dv.filter_params.length > 0 || dv.group_params)) {
      const p = new URLSearchParams()
      dv.filter_params.forEach((f) => p.append('f', f))
      if (dv.group_params) p.set('group', dv.group_params)
      if (dv.sort_params) p.set('sort', dv.sort_params)
      redirect(`/tasks?${p.toString()}`)
    }
  }
  const conditions = parseFilterParams(filterRaw)

  const raw = await db.select({
    id:          tasks.id,
    title:       tasks.title,
    done:        tasks.done,
    priority:    tasks.priority,
    due_date:    tasks.due_date,
    account_id:  tasks.account_id,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
    opportunities: {
      id:   opportunities.id,
      name: opportunities.name,
    },
  })
    .from(tasks)
    .leftJoin(accounts, eq(tasks.account_id, accounts.id))
    .leftJoin(opportunities, eq(tasks.opportunity_id, opportunities.id))
    .orderBy(asc(tasks.done), asc(tasks.due_date), desc(tasks.created_at))

  const tasksList  = applyFilters(raw as Record<string, unknown>[], conditions) as typeof raw
  const sortRaw    = sp.sort ?? ''
  const sorted     = applySort(tasksList as Record<string, unknown>[], parseSortParams(sortRaw)) as typeof raw
  const hasFilter  = conditions.length > 0
  const totalCount = sorted.length
  const totalPages = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const today      = new Date().toISOString().slice(0, 10)

  const displayList = isGrouped
    ? sorted
    : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as typeof raw

  const pending = (displayList as typeof raw).filter((t) => !t.done)
  const done    = (displayList as typeof raw).filter((t) =>  t.done)

  async function toggleDone(formData: FormData) {
    'use server'
    const id   = formData.get('id') as string
    const doneVal = formData.get('done') === 'true'
    await toggleTaskDone(id, doneVal, '/tasks')
  }

  const groupableFields = FIELDS
    .filter((f) => f.value !== 'done')
    .map((f) => ({ key: f.value, label: f.label }))

  const TaskTable = ({ rows, label }: { rows: typeof tasksList; label: string }) => (
    <div>
      {/* PC: テーブル */}
      <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label} ({rows.length})</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-400 text-center">すべて完了しています 🎉</p>
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
                      <form action={toggleDone}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="done" value={(!task.done).toString()} />
                        <button type="submit" title={task.done ? '未完了に戻す' : '完了にする'}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mx-auto ${task.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                          {task.done && <span className="text-xs leading-none">✓</span>}
                        </button>
                      </form>
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
          <p className="text-sm text-zinc-400 text-center py-6 bg-white rounded-lg border border-zinc-200">すべて完了しています 🎉</p>
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
                    <form action={toggleDone}>
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="done" value={(!task.done).toString()} />
                      <button type="submit"
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                        {task.done && <span className="text-xs leading-none">✓</span>}
                      </button>
                    </form>
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
                        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                          📅 {new Date(task.due_date).toLocaleDateString('ja-JP')}{isOverdue ? ' (超過)' : ''}
                        </span>
                      )}
                      {account && <span>🏢 {account.name}</span>}
                      {opportunity && <span>💼 {opportunity.name}</span>}
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
            全 {totalCount} 件（未完了 {sorted.filter((t) => !t.done).length} 件）
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <p className="text-4xl mb-4">✅</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致するToDoがありません' : 'ToDoがありません'}
          </p>
          {hasFilter
            ? <Link href="/tasks" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : isGrouped ? (
        /* グルーピング時: TasksTableView（PC のみ） */
        <div className="hidden md:block">
          <TasksTableView
            records={displayList as Record<string, unknown>[]}
            groupBy={groupBy}
            fields={FIELDS}
            activeKeys={colConfig}
            currentSortStr={sortRaw}
          />
        </div>
      ) : (
        /* 通常時: 未完了 / 完了済み 分割表示 */
        <div className="space-y-4">
          <TaskTable rows={pending} label="未完了" />
          {done.length > 0 && <TaskTable rows={done} label="完了済み" />}
        </div>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/tasks" filterParams={filterRaw} />
      )}
    </div>
  )
}
