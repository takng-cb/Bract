import { db } from '@/lib/db'
import { accounts, contacts, opportunities } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import TaskForm from '@/components/TaskForm'
import { createTask } from '@/app/actions/tasks'

async function createTaskAction(_: string | null, formData: FormData): Promise<string | null> {
  'use server'
  try { await createTask(formData); return null }
  catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
}

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string }>
}) {
  const { account_id, contact_id, opportunity_id } = await searchParams

  const [accountsList, contactsList, opportunitiesList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
  ])

  const cancelHref = account_id
    ? `/accounts/${account_id}`
    : contact_id
    ? `/contacts/${contact_id}`
    : opportunity_id
    ? `/opportunities/${opportunity_id}`
    : '/tasks'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/tasks" className="hover:text-zinc-600">ToDo</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">ToDoを追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <TaskForm
          action={createTaskAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          defaultValues={{
            account_id: account_id ?? '',
            contact_id: contact_id ?? '',
            opportunity_id: opportunity_id ?? '',
          }}
        />
      </div>
    </div>
  )
}
