import { db } from '@/lib/db'
import { tasks, task_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordId from '@/components/RecordId'
import { deleteTask, toggleTaskDone } from '@/app/actions/tasks'
import DeleteButton from '@/components/DeleteButton'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import { resolveRelatedRecords } from '@/lib/relatedRecords'

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  high:   { label: '高', bg: 'bg-red-100',    text: 'text-red-700' },
  medium: { label: '中', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low:    { label: '低', bg: 'bg-green-100',  text: 'text-green-700' },
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [task, relatedPairs] = await Promise.all([
    db.select({
      id: tasks.id, title: tasks.title, description: tasks.description, done: tasks.done,
      priority: tasks.priority, due_date: tasks.due_date, created_at: tasks.created_at,
    })
      .from(tasks)
      .where(eq(tasks.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      object_api: task_related_records.related_object_api,
      record_id:  task_related_records.related_record_id,
    })
      .from(task_related_records)
      .where(eq(task_related_records.task_id, id)),
  ])

  if (!task) notFound()

  const allRelated = await resolveRelatedRecords(relatedPairs)
  const priority   = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium

  async function handleDelete() {
    'use server'
    await deleteTask(id)
  }

  async function toggleDone(formData: FormData) {
    'use server'
    const done = formData.get('done') === 'true'
    await toggleTaskDone(id, done, `/tasks/${id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <RecordHeader
        crumbs={[
          { label: 'ToDo', href: '/tasks' },
          { label: task.title },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/tasks/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="このToDoを削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <AuthGuard minRole="editor">
            <form action={toggleDone} className="mt-1 shrink-0">
              <input type="hidden" name="done" value={(!task.done).toString()} />
              <button
                type="submit"
                title={task.done ? '未完了に戻す' : '完了にする'}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${task.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}
              >
                {task.done && <span className="text-sm leading-none">✓</span>}
              </button>
            </form>
          </AuthGuard>
          <h1 className={`text-2xl font-bold min-w-0 break-words ${task.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{task.title}</h1>
        </div>
        <div className="flex items-center gap-2 mt-2 ml-9">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.bg} ${priority.text}`}>優先度: {priority.label}</span>
          {task.done && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">完了</span>}
        </div>
      </div>

      {/* 関連レコード（junction 経由で全件表示） */}
      <div className="mb-4 bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">関連レコード</p>
        {allRelated.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {allRelated.map((r, i) => (
              <Link key={`${r.href}-${i}`} href={r.href} className="text-sm text-blue-600 hover:underline">
                {r.icon} {r.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">紐づくレコードなし</p>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">詳細情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{task.created_at ? new Date(task.created_at).toLocaleDateString('ja-JP') : '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-400 mb-1">詳細・メモ</dt>
            <dd className="text-sm text-zinc-800 whitespace-pre-wrap break-words">
              {task.description ? task.description : <span className="text-zinc-300">—</span>}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
