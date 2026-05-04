'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import { expenses } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createExpense(formData: FormData) {
  await requireEditor()
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('件名は必須です')
  const amount = formData.get('amount') as string
  if (!amount || Number(amount) <= 0) throw new Error('金額は0より大きい値を入力してください')

  const expense_date   = formData.get('expense_date') as string
  const opportunity_id = (formData.get('opportunity_id') as string) || null
  const account_id     = (formData.get('account_id') as string) || null
  const contact_id     = (formData.get('contact_id') as string) || null

  const [row] = await db.insert(expenses).values({
    title:        title.trim(),
    amount:       String(Number(amount)),
    category:     (formData.get('category') as string) || 'その他',
    expense_date: expense_date || new Date().toISOString().slice(0, 10),
    account_id,
    contact_id,
    opportunity_id,
    notes: (formData.get('notes') as string) || null,
  }).returning({ id: expenses.id })

  if (opportunity_id) redirect(`/opportunities/${opportunity_id}`)
  if (account_id)     redirect(`/accounts/${account_id}`)
  redirect(`/expenses/${row.id}`)
}

export async function updateExpense(id: string, formData: FormData) {
  await requireEditor()
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('件名は必須です')
  const amount = formData.get('amount') as string
  if (!amount || Number(amount) <= 0) throw new Error('金額は0より大きい値を入力してください')

  await db.update(expenses).set({
    title:          title.trim(),
    amount:         String(Number(amount)),
    category:       (formData.get('category') as string) || 'その他',
    expense_date:   (formData.get('expense_date') as string) || new Date().toISOString().slice(0, 10),
    account_id:     (formData.get('account_id') as string) || null,
    contact_id:     (formData.get('contact_id') as string) || null,
    opportunity_id: (formData.get('opportunity_id') as string) || null,
    notes:          (formData.get('notes') as string) || null,
    updated_at:     new Date(),
  }).where(eq(expenses.id, id))

  redirect(`/expenses/${id}`)
}

export async function deleteExpense(id: string, revalidate: string) {
  await requireEditor()
  await db.delete(expenses).where(eq(expenses.id, id))
  revalidatePath(revalidate)
  revalidatePath('/expenses')
}
