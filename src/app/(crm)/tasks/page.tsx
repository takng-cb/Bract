import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

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
  searchParams: Promise<{ f?: string | string[] }>
}) {
  const sp = await searchParams
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)

  const { data: raw, error } = await supabase
    .from('tasks')
    .select('*, accounts(id, name), opportunities(id, name)')
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-8 text-red-600">データの取得に失敗しました: {error.message}</div>
  }

  const tasks     = applyFilters(raw as Record<string, unknown>[], conditions) as typeof raw
  const hasFilter = conditions.length > 0
  const pending   = tasks.filter((t) => !t.done)
  const done      = tasks.filter((t) =>  t.done)

  async function toggleDone(formData: FormData) {
    'use server'
    const id   = formData.get('id') as string
    const done = formData.get('done') === 'true'
    await supabase.from('tasks').update({ done, updated_at: new Date().toISOString() }).eq('id', id)
    revalidatePath('/tasks')
  }

  const today = new Date().toISOString().slice(0, 10)

  const TaskTable = ({ rows, label }: { rows: typeof tasks; label: string }) => (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
      {/* セクションヘッダー */}
      <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          {label} ({rows.length})
        </span>
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
              const account     = task.accounts     as { id: string; name: string } | null
              const opportunity = task.opportunities as { id: string; name: string } | null
              const priority    = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue   = !task.done && task.due_date && task.due_date < today

              return (
                <tr key={task.id} className={`hover:bg-zinc-50 transition-colors ${task.done ? 'opacity-50' : ''}`}>
                  {/* チェックボックス */}
                  <td className="px-4 py-3 text-center">
                    <form action={toggleDone}>
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="done" value={(!task.done).toString()} />
                      <button
                        type="submit"
                        title={task.done ? '未完了に戻す' : '完了にする'}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mx-auto
                          ${task.done
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-zinc-300 hover:border-blue-400'
                          }`}
                      >
                        {task.done && <span className="text-xs leading-none">✓</span>}
                      </button>
                    </form>
                  </td>

                  {/* タイトル */}
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/tasks/${task.id}`}
                      className={`hover:text-blue-600 ${task.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}
                    >
                      {task.title}
                    </Link>
                  </td>

                  {/* 優先度 */}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>
                      {priority.label}
                    </span>
                  </td>

                  {/* 期限日 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.due_date ? (
                      <span className={`text-sm ${isOverdue ? 'text-red-500 font-medium' : 'text-zinc-500'}`}>
                        {new Date(task.due_date).toLocaleDateString('ja-JP')}
                        {isOverdue && <span className="ml-1 text-xs">(超過)</span>}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>

                  {/* 取引先 */}
                  <td className="px-4 py-3 text-zinc-600">
                    {account
                      ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">{account.name}</Link>
                      : <span className="text-zinc-300">—</span>
                    }
                  </td>

                  {/* 商談 */}
                  <td className="px-4 py-3 text-zinc-600">
                    {opportunity
                      ? <Link href={`/opportunities/${opportunity.id}`} className="hover:text-blue-600 text-xs">{opportunity.name}</Link>
                      : <span className="text-zinc-300">—</span>
                    }
                  </td>

                  {/* 編集 */}
                  <td className="px-4 py-3 text-right">
                    <Link href={`/tasks/${task.id}/edit`} className="text-xs text-zinc-400 hover:text-zinc-700">
                      編集
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">ToDo</h1>
          <p className="text-sm text-zinc-500 mt-1">
            未完了 {pending.length} 件 / 完了済み {done.length} 件
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ 新規作成
        </Link>
      </div>

      <FilterBuilder fields={FIELDS} initialFilters={filterRaw} basePath="/tasks" />

      {tasks.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          <TaskTable rows={pending} label="未完了" />
          {done.length > 0 && <TaskTable rows={done} label="完了済み" />}
        </div>
      )}
    </div>
  )
}
