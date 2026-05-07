'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import { tasks } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTask(formData: FormData) {
  await requireEditor()
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('タイトルは必須です')

  const account_id       = (formData.get('account_id')       as string) || null
  const contact_id       = (formData.get('contact_id')       as string) || null
  const opportunity_id   = (formData.get('opportunity_id')   as string) || null
  const custom_record_id = (formData.get('custom_record_id') as string) || null
  const return_to        = (formData.get('return_to')        as string) || null

  const [row] = await db.insert(tasks).values({
    title:            title.trim(),
    due_date:         (formData.get('due_date') as string) || null,
    priority:         (formData.get('priority') as string) || 'medium',
    account_id,
    contact_id,
    opportunity_id,
    custom_record_id,
  }).returning({ id: tasks.id })

  if (return_to)      redirect(return_to)
  if (account_id)     redirect(`/accounts/${account_id}`)
  if (contact_id)     redirect(`/contacts/${contact_id}`)
  if (opportunity_id) redirect(`/opportunities/${opportunity_id}`)
  redirect(`/tasks/${row.id}`)
}

export async function updateTask(id: string, formData: FormData) {
  await requireEditor()
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('タイトルは必須です')

  await db.update(tasks).set({
    title:          title.trim(),
    due_date:       (formData.get('due_date') as string) || null,
    priority:       (formData.get('priority') as string) || 'medium',
    account_id:     (formData.get('account_id') as string) || null,
    contact_id:     (formData.get('contact_id') as string) || null,
    opportunity_id: (formData.get('opportunity_id') as string) || null,
    updated_at:     new Date(),
  }).where(eq(tasks.id, id))

  redirect(`/tasks/${id}`)
}

export async function deleteTask(id: string) {
  await requireEditor()
  await db.delete(tasks).where(eq(tasks.id, id))
  redirect('/tasks')
}

export async function toggleTaskDone(id: string, done: boolean, revalidate: string) {
  await requireEditor()
  await db.update(tasks)
    .set({ done, updated_at: new Date() })
    .where(eq(tasks.id, id))
  revalidatePath(revalidate)
  revalidatePath('/tasks')
}
