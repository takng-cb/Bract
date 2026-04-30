'use server'

import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

async function syncActivityContacts(activityId: string, contactIds: string[]) {
  // 既存の紐づけを全削除してから再挿入
  await supabase.from('activity_contacts').delete().eq('activity_id', activityId)
  if (contactIds.length > 0) {
    await supabase.from('activity_contacts').insert(
      contactIds.map((contact_id) => ({ activity_id: activityId, contact_id }))
    )
  }
}

export async function updateActivity(id: string, formData: FormData) {
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const contactIds = formData.getAll('contact_ids') as string[]
  const primaryContactId = contactIds[0] ?? null

  const { error } = await supabase.from('activities').update({
    subject: subject.trim(),
    type,
    body: (formData.get('body') as string) || null,
    occurred_at: occurred_at || new Date().toISOString(),
    account_id: (formData.get('account_id') as string) || null,
    contact_id: primaryContactId,
    opportunity_id: (formData.get('opportunity_id') as string) || null,
  }).eq('id', id)

  if (error) throw new Error(error.message)

  await syncActivityContacts(id, contactIds)

  redirect(`/activities/${id}`)
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw new Error(error.message)
  redirect('/activities')
}

export async function createActivity(formData: FormData) {
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const account_id = formData.get('account_id') as string
  const opportunity_id = formData.get('opportunity_id') as string
  const contactIds = formData.getAll('contact_ids') as string[]
  const primaryContactId = contactIds[0] ?? null

  const { data, error } = await supabase.from('activities').insert({
    subject: subject.trim(),
    type,
    body: (formData.get('body') as string) || null,
    occurred_at: occurred_at || new Date().toISOString(),
    account_id: account_id || null,
    contact_id: primaryContactId,
    opportunity_id: opportunity_id || null,
  }).select('id').single()

  if (error) throw new Error(error.message)

  await syncActivityContacts(data.id, contactIds)

  // 戻り先を決定（関連するレコードの詳細ページへ）
  if (account_id) redirect(`/accounts/${account_id}`)
  if (primaryContactId) redirect(`/contacts/${primaryContactId}`)
  if (opportunity_id) redirect(`/opportunities/${opportunity_id}`)
  redirect('/activities')
}
