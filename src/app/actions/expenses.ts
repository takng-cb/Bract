'use server'

import { requireEditor } from '@/lib/auth'
import { recordHref } from '@/lib/relatedRecords'

import { db } from '@/lib/db'
import { expenses, expense_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function parseRelatedRecords(formData: FormData): { object_api: string; record_id: string }[] {
  const raw = formData.getAll('related_records') as string[]
  const out: { object_api: string; record_id: string }[] = []
  for (const r of raw) {
    const idx = r.indexOf(':')
    if (idx < 0) continue
    const api = r.slice(0, idx).trim()
    const id  = r.slice(idx + 1).trim()
    if (api && id) out.push({ object_api: api, record_id: id })
  }
  return out
}

async function syncExpenseRelatedRecords(
  expenseId: string,
  selections: { object_api: string; record_id: string }[],
) {
  // Phase 2: junction が唯一の関連先情報（FK 列への dual-write は撤廃）
  await db.delete(expense_related_records).where(eq(expense_related_records.expense_id, expenseId))
  if (selections.length > 0) {
    const seen = new Set<string>()
    const rows = selections
      .filter((s) => {
        const k = `${s.object_api}::${s.record_id}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((s) => ({
        expense_id:         expenseId,
        related_object_api: s.object_api,
        related_record_id:  s.record_id,
      }))
    if (rows.length > 0) {
      await db.insert(expense_related_records).values(rows).onConflictDoNothing()
    }
  }
}

export async function createExpense(formData: FormData) {
  await requireEditor()
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('件名は必須です')
  const amount = formData.get('amount') as string
  if (!amount || Number(amount) <= 0) throw new Error('金額は0より大きい値を入力してください')

  const expense_date = formData.get('expense_date') as string
  const return_to    = (formData.get('return_to') as string) || null
  const selections   = parseRelatedRecords(formData)

  const [row] = await db.insert(expenses).values({
    title:        title.trim(),
    amount:       String(Number(amount)),
    category:     (formData.get('category') as string) || 'その他',
    expense_date: expense_date || new Date().toISOString().slice(0, 10),
    notes:        (formData.get('notes') as string) || null,
  }).returning({ id: expenses.id })

  await syncExpenseRelatedRecords(row.id, selections)

  if (return_to) redirect(return_to)
  const firstOpportunity = selections.find((s) => s.object_api === 'opportunity')
  if (firstOpportunity) redirect(`/opportunities/${firstOpportunity.record_id}`)
  const firstAccount = selections.find((s) => s.object_api === 'account')
  if (firstAccount) redirect(`/accounts/${firstAccount.record_id}`)
  const firstContact = selections.find((s) => s.object_api === 'contact')
  if (firstContact) redirect(`/contacts/${firstContact.record_id}`)
  const firstCustom = selections.find((s) => !['account', 'contact', 'opportunity'].includes(s.object_api))
  if (firstCustom) redirect(recordHref(firstCustom.object_api, firstCustom.record_id))
  redirect(`/expenses/${row.id}`)
}

/**
 * インライン編集用・部分更新。関連レコードには触れない（別途「関連」画面）。
 * 件名(title) は必須のため空送信時は更新しない。
 */
export async function updateExpenseBasic(id: string, formData: FormData) {
  await requireEditor()
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('title') && (formData.get('title') as string)?.trim()) set.title = (formData.get('title') as string).trim()
  if (formData.has('amount')) {
    const a = formData.get('amount') as string
    if (a && Number(a) > 0) set.amount = String(Number(a))
  }
  if (formData.has('category'))     set.category = (formData.get('category') as string) || 'その他'
  if (formData.has('expense_date')) set.expense_date = (formData.get('expense_date') as string) || new Date().toISOString().slice(0, 10)
  if (formData.has('notes'))        set.notes = (formData.get('notes') as string) || null
  await db.update(expenses).set(set).where(eq(expenses.id, id))
  redirect(`/expenses/${id}`)
}

export async function updateExpense(id: string, formData: FormData) {
  await requireEditor()
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('件名は必須です')
  const amount = formData.get('amount') as string
  if (!amount || Number(amount) <= 0) throw new Error('金額は0より大きい値を入力してください')

  const selections = parseRelatedRecords(formData)

  await db.update(expenses).set({
    title:        title.trim(),
    amount:       String(Number(amount)),
    category:     (formData.get('category') as string) || 'その他',
    expense_date: (formData.get('expense_date') as string) || new Date().toISOString().slice(0, 10),
    notes:        (formData.get('notes') as string) || null,
    updated_at:   new Date(),
  }).where(eq(expenses.id, id))

  await syncExpenseRelatedRecords(id, selections)

  redirect(`/expenses/${id}`)
}

export async function deleteExpense(id: string, revalidate: string) {
  await requireEditor()
  await db.delete(expenses).where(eq(expenses.id, id))
  revalidatePath(revalidate)
  revalidatePath('/expenses')
}
