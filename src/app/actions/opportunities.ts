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

  const amount           = formData.get('amount') as string
  const close_date       = formData.get('close_date') as string
  const probability      = formData.get('probability') as string
  const transaction_type = formData.get('transaction_type') as string
  const commission_fee   = formData.get('commission_fee') as string
  const brokerage_type   = formData.get('brokerage_type') as string
  const other_profit     = formData.get('other_profit') as string

  const [row] = await db.insert(opportunities).values({
    name:             name.trim(),
    account_id:       (formData.get('account_id') as string) || null,
    contact_id:       (formData.get('contact_id') as string) || null,
    stage:            (formData.get('stage') as string) || 'prospecting',
    amount:           amount ? String(Number(amount)) : null,
    close_date:       close_date || null,
    probability:      probability ? Number(probability) : null,
    description:      (formData.get('description') as string) || null,
    owner_id:         (formData.get('owner_id') as string) || null,
    transaction_type: transaction_type === '賃貸' ? '賃貸' : '売買',
    commission_fee:   commission_fee ? String(Number(commission_fee)) : null,
    brokerage_type:   brokerage_type || null,
    other_profit:     other_profit ? String(Number(other_profit)) : '0',
  }).returning({ id: opportunities.id })

  return row.id
}

export async function updateOpportunity(id: string, formData: FormData) {
  await requireEditor()
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('商談名は必須です')

  const amount           = formData.get('amount') as string
  const close_date       = formData.get('close_date') as string
  const probability      = formData.get('probability') as string
  const stage            = (formData.get('stage') as string) || 'prospecting'
  const transaction_type = formData.get('transaction_type') as string
  const commission_fee   = formData.get('commission_fee') as string
  const brokerage_type   = formData.get('brokerage_type') as string
  const other_profit     = formData.get('other_profit') as string
  const txTypeNormalized = transaction_type === '賃貸' ? '賃貸' : '売買'

  const [before] = await db.select({
    name: opportunities.name, stage: opportunities.stage,
    amount: opportunities.amount, close_date: opportunities.close_date,
    probability: opportunities.probability,
    transaction_type: opportunities.transaction_type,
    commission_fee: opportunities.commission_fee,
    brokerage_type: opportunities.brokerage_type,
    other_profit: opportunities.other_profit,
  }).from(opportunities).where(eq(opportunities.id, id))

  await db.update(opportunities).set({
    name:             name.trim(),
    account_id:       (formData.get('account_id') as string) || null,
    contact_id:       (formData.get('contact_id') as string) || null,
    stage,
    amount:           amount ? String(Number(amount)) : null,
    close_date:       close_date || null,
    probability:      probability ? Number(probability) : null,
    description:      (formData.get('description') as string) || null,
    owner_id:         (formData.get('owner_id') as string) || null,
    transaction_type: txTypeNormalized,
    commission_fee:   commission_fee ? String(Number(commission_fee)) : null,
    brokerage_type:   brokerage_type || null,
    other_profit:     other_profit ? String(Number(other_profit)) : '0',
    updated_at:       new Date(),
  }).where(eq(opportunities.id, id))

  if (before) {
    await logChanges('opportunity', id,
      {
        name:             { label: '商談名',     value: before.name },
        stage:            { label: 'ステージ',   value: before.stage },
        amount:           { label: '金額',       value: before.amount },
        close_date:       { label: '完了予定日', value: before.close_date },
        probability:      { label: '確度',       value: before.probability },
        transaction_type: { label: '取引区分',   value: before.transaction_type },
        commission_fee:   { label: '仲介手数料', value: before.commission_fee },
        brokerage_type:   { label: '仲介種別',   value: before.brokerage_type },
        other_profit:     { label: 'その他利益', value: before.other_profit },
      },
      {
        name:             { label: '商談名',     value: name.trim() },
        stage:            { label: 'ステージ',   value: stage },
        amount:           { label: '金額',       value: amount ? Number(amount) : null },
        close_date:       { label: '完了予定日', value: close_date || null },
        probability:      { label: '確度',       value: probability ? Number(probability) : null },
        transaction_type: { label: '取引区分',   value: txTypeNormalized },
        commission_fee:   { label: '仲介手数料', value: commission_fee ? Number(commission_fee) : null },
        brokerage_type:   { label: '仲介種別',   value: brokerage_type || null },
        other_profit:     { label: 'その他利益', value: other_profit ? Number(other_profit) : 0 },
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
