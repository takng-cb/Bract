import { db } from '@/lib/db'
import { tasks, accounts, contacts, opportunities } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import TaskForm from '@/components/TaskForm'
import { updateTask } from '@/app/actions/tasks'
import { requireEditor } from '@/lib/auth'

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [task, accountsList, contactsList, opportunitiesList] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
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
    <div className="p-4 md:p-8 max-w-2xl">
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
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          defaultValues={task}
        />
      </div>
    </div>
  )
}
