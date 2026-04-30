import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import TaskForm from '@/components/TaskForm'
import { updateTask } from '@/app/actions/tasks'

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: task }, { data: accounts }, { data: contacts }, { data: opportunities }] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').eq('status', 'active').order('name'),
    supabase.from('contacts').select('id, full_name').order('full_name'),
    supabase.from('opportunities').select('id, name').order('name'),
  ])

  if (!task) notFound()

  async function updateTaskAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateTask(id, formData); return null }
    catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/tasks" className="hover:text-zinc-600">ToDo</Link>
        <span className="mx-2">/</span>
        <Link href={`/tasks/${id}`} className="hover:text-zinc-600 line-clamp-1">{task.title}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">ToDoを編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <TaskForm
          action={updateTaskAction}
          cancelHref={`/tasks/${id}`}
          accounts={accounts ?? []}
          contacts={contacts ?? []}
          opportunities={opportunities ?? []}
          defaultValues={task}
        />
      </div>
    </div>
  )
}
