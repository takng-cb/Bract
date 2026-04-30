'use server'

import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTask(formData: FormData) {
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('タイトルは必須です')

  const account_id = (formData.get('account_id') as string) || null
  const contact_id = (formData.get('contact_id') as string) || null
  const opportunity_id = (formData.get('opportunity_id') as string) || null

  const { data, error } = await supabase.from('tasks').insert({
    title: title.trim(),
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'medium',
    account_id,
    contact_id,
    opportunity_id,
  }).select('id').single()

  if (error) throw new Error(error.message)

  // 登録元のレコードに戻る
  if (account_id) redirect(`/accounts/${account_id}`)
  if (contact_id) redirect(`/contacts/${contact_id}`)
  if (opportunity_id) redirect(`/opportunities/${opportunity_id}`)
  redirect(`/tasks/${data.id}`)
}

export async function updateTask(id: string, formData: FormData) {
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('タイトルは必須です')

  const { error } = await supabase.from('tasks').update({
    title: title.trim(),
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'medium',
    account_id: (formData.get('account_id') as string) || null,
    contact_id: (formData.get('contact_id') as string) || null,
    opportunity_id: (formData.get('opportunity_id') as string) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) throw new Error(error.message)
  redirect(`/tasks/${id}`)
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
  redirect('/tasks')
}

export async function toggleTaskDone(id: string, done: boolean, revalidate: string) {
  const { error } = await supabase
    .from('tasks')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(revalidate)
  revalidatePath('/tasks')
}
