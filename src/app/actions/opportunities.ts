'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import { opportunities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logChanges } from '@/lib/changeLog'

export async function updateOpportunityStage(id: string, stage: string) {
  await requireEditor()
  const [before] = await db.select({ stage: opportunities.stage })
    .from(opportunities).where(eq(opportunities.id, id))

  await db.update(opportunities)
    .set({ stage, updated_at: new Date() })
    .where(eq(opportunities.id, id))

  await logChanges('opportunity', id,
    { stage: { label: 'ステージ', value: before?.stage } },
    { stage: { label: 'ステージ', value: stage } },
  )

  revalidatePath(`/opportunities/${id}`)
}

export async function createOpportunity(formData: FormData): Promise<string> {
  await requireEditor()
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('商談名は必須です')

  const amount      = formData.get('amount') as string
  const close_date  = formData.get('close_date') as string
  const probability = formData.get('probability') as string

  const [row] = await db.insert(opportunities).values({
    name:        name.trim(),
    account_id:  (formData.get('account_id') as string) || null,
    contact_id:  (formData.get('contact_id') as string) || null,
    stage:       (formData.get('stage') as string) || 'prospecting',
    amount:      amount ? String(Number(amount)) : null,
    close_date:  close_date || null,
    probability: probability ? Number(probability) : null,
    description: (formData.get('description') as string) || null,
  }).returning({ id: opportunities.id })

  return row.id
}

export async function updateOpportunity(id: string, formData: FormData) {
  await requireEditor()
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('商談名は必須です')

  const amount      = formData.get('amount') as string
  const close_date  = formData.get('close_date') as string
  const probability = formData.get('probability') as string
  const stage       = (formData.get('stage') as string) || 'prospecting'

  const [before] = await db.select({
    name: opportunities.name, stage: opportunities.stage,
    amount: opportunities.amount, close_date: opportunities.close_date,
    probability: opportunities.probability,
  }).from(opportunities).where(eq(opportunities.id, id))

  await db.update(opportunities).set({
    name:        name.trim(),
    account_id:  (formData.get('account_id') as string) || null,
    contact_id:  (formData.get('contact_id') as string) || null,
    stage,
    amount:      amount ? String(Number(amount)) : null,
    close_date:  close_date || null,
    probability: probability ? Number(probability) : null,
    description: (formData.get('description') as string) || null,
    updated_at:  new Date(),
  }).where(eq(opportunities.id, id))

  if (before) {
    await logChanges('opportunity', id,
      {
        name:        { label: '商談名',     value: before.name },
        stage:       { label: 'ステージ',   value: before.stage },
        amount:      { label: '金額',       value: before.amount },
        close_date:  { label: '完了予定日', value: before.close_date },
        probability: { label: '確度',       value: before.probability },
      },
      {
        name:        { label: '商談名',     value: name.trim() },
        stage:       { label: 'ステージ',   value: stage },
        amount:      { label: '金額',       value: amount ? Number(amount) : null },
        close_date:  { label: '完了予定日', value: close_date || null },
        probability: { label: '確度',       value: probability ? Number(probability) : null },
      },
    )
  }

  redirect(`/opportunities/${id}`)
}

export async function deleteOpportunity(id: string) {
  await requireEditor()
  await db.delete(opportunities).where(eq(opportunities.id, id))
  redirect('/opportunities')
}
