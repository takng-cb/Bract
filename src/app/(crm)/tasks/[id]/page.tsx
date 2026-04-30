import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { deleteTask } from '@/app/actions/tasks'
import DeleteButton from '@/components/DeleteButton'

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  high:   { label: '高', bg: 'bg-red-100',    text: 'text-red-700' },
  medium: { label: '中', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low:    { label: '低', bg: 'bg-green-100',  text: 'text-green-700' },
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: task } = await supabase
    .from('tasks')
    .select('*, accounts(id, name), contacts(id, full_name), opportunities(id, name)')
    .eq('id', id)
    .single()

  if (!task) notFound()

  const account     = task.accounts     as { id: string; name: string } | null
  const contact     = task.contacts     as { id: string; full_name: string } | null
  const opportunity = task.opportunities as { id: string; name: string } | null
  const priority    = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium

  async function handleDelete() {
    'use server'
    await deleteTask(id)
  }

  async function toggleDone(formData: FormData) {
    'use server'
    const done = formData.get('done') === 'true'
    await supabase.from('tasks').update({ done, updated_at: new Date().toISOString() }).eq('id', id)
    revalidatePath(`/tasks/${id}`)
    revalidatePath('/tasks')
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* パンくず */}
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/tasks" className="hover:text-zinc-600">ToDo</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 line-clamp-1">{task.title}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          {/* 完了トグル */}
          <form action={toggleDone} className="mt-1 shrink-0">
            <input type="hidden" name="done" value={(!task.done).toString()} />
            <button
              type="submit"
              title={task.done ? '未完了に戻す' : '完了にする'}
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                ${task.done
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-zinc-300 hover:border-blue-400'
                }`}
            >
              {task.done && <span className="text-sm leading-none">✓</span>}
            </button>
          </form>
          <div>
            <h1 className={`text-2xl font-bold ${task.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
              {task.title}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.bg} ${priority.text}`}>
                優先度: {priority.label}
              </span>
              {task.done && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">完了</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tasks/${id}/edit`}
            className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
          >
            編集
          </Link>
          <DeleteButton
            action={handleDelete}
            confirmMessage="このToDoを削除しますか？"
          />
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">詳細情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">期限</dt>
            <dd className="text-sm text-zinc-800">
              {task.due_date ? (
                <span className={!task.done && new Date(task.due_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                  {new Date(task.due_date).toLocaleDateString('ja-JP')}
                  {!task.done && new Date(task.due_date) < new Date() && ' (期限超過)'}
                </span>
              ) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">ステータス</dt>
            <dd className="text-sm text-zinc-800">{task.done ? '✅ 完了' : '⏳ 未完了'}</dd>
          </div>
          {account && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
              <dd className="text-sm">
                <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">
                  🏢 {account.name}
                </Link>
              </dd>
            </div>
          )}
          {contact && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
              <dd className="text-sm">
                <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">
                  👤 {contact.full_name}
                </Link>
              </dd>
            </div>
          )}
          {opportunity && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">商談</dt>
              <dd className="text-sm">
                <Link href={`/opportunities/${opportunity.id}`} className="text-blue-600 hover:underline">
                  💼 {opportunity.name}
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{new Date(task.created_at).toLocaleDateString('ja-JP')}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
