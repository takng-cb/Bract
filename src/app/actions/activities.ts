'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import { activities, activity_contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

async function syncActivityContacts(activityId: string, contactIds: string[]) {
  await db.delete(activity_contacts).where(eq(activity_contacts.activity_id, activityId))
  if (contactIds.length > 0) {
    await db.insert(activity_contacts).values(
      contactIds.map((contact_id) => ({ activity_id: activityId, contact_id }))
    )
  }
}

export async function updateActivity(id: string, formData: FormData) {
  await requireEditor()
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const contactIds = formData.getAll('contact_ids') as string[]
  const primaryContactId = contactIds[0] ?? null

  await db.update(activities).set({
    subject:        subject.trim(),
    type,
    body:           (formData.get('body') as string) || null,
    occurred_at:    occurred_at ? new Date(occurred_at) : new Date(),
    account_id:     (formData.get('account_id') as string) || null,
    contact_id:     primaryContactId,
    opportunity_id: (formData.get('opportunity_id') as string) || null,
  }).where(eq(activities.id, id))

  await syncActivityContacts(id, contactIds)

  redirect(`/activities/${id}`)
}

export async function deleteActivity(id: string) {
  await requireEditor()
  await db.delete(activities).where(eq(activities.id, id))
  redirect('/activities')
}

export async function createActivity(formData: FormData) {
  await requireEditor()
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at    = formData.get('occurred_at') as string
  const account_id     = formData.get('account_id') as string
  const opportunity_id = formData.get('opportunity_id') as string
  const contactIds     = formData.getAll('contact_ids') as string[]
  const primaryContactId = contactIds[0] ?? null

  const custom_record_id = (formData.get('custom_record_id') as string) || null
  const return_to        = (formData.get('return_to')        as string) || null

  const [row] = await db.insert(activities).values({
    subject:          subject.trim(),
    type,
    body:             (formData.get('body') as string) || null,
    occurred_at:      occurred_at ? new Date(occurred_at) : new Date(),
    account_id:       account_id || null,
    contact_id:       primaryContactId,
    opportunity_id:   opportunity_id || null,
    custom_record_id: custom_record_id || null,
  }).returning({ id: activities.id })

  await syncActivityContacts(row.id, contactIds)

  if (return_to)         redirect(return_to)
  if (account_id)        redirect(`/accounts/${account_id}`)
  if (primaryContactId)  redirect(`/contacts/${primaryContactId}`)
  if (opportunity_id)    redirect(`/opportunities/${opportunity_id}`)
  redirect('/activities')
}
