'use server'

import { recordHref } from '@/lib/relatedRecords'
import { trashRecord } from '@/lib/trash'

import { db } from '@/lib/db'
import { expenses, expense_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { withSaveToast } from '@/lib/saveToast'
import { requirePermission } from '@/lib/permissions'
import { assertNotPendingApproval } from '@/app/actions/approvals'

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

/**
 * レシート項目（#134 Phase A）の正規化。税率は 0〜100 のみ、
 * インボイス登録番号は T+13桁の形式チェックのみ（不正形式はエラー。ADR-0026）。
 */
function parseReceiptFields(formData: FormData): { vendor: string | null; tax_rate: string | null; invoice_reg_no: string | null } {
  const vendor = (formData.get('vendor') as string)?.trim() || null
  const taxRaw = (formData.get('tax_rate') as string)?.trim() || ''
  const tax = Number(taxRaw)
  if (taxRaw && (!Number.isFinite(tax) || tax < 0 || tax > 100)) throw new Error('税率は 0〜100 の数値で入力してください')
  const regRaw = (formData.get('invoice_reg_no') as string)?.replace(/[\s-]/g, '').toUpperCase() || ''
  if (regRaw && !/^T\d{13}$/.test(regRaw)) throw new Error('インボイス登録番号は「T+数字13桁」の形式で入力してください（例: T1234567890123）')
  return { vendor, tax_rate: taxRaw ? String(tax) : null, invoice_reg_no: regRaw || null }
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
  await requirePermission('expenses', 'create')
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
    ...parseReceiptFields(formData),
  }).returning({ id: expenses.id })

  await syncExpenseRelatedRecords(row.id, selections)

  if (return_to) redirect(withSaveToast(return_to, 'created'))
  const firstOpportunity = selections.find((s) => s.object_api === 'opportunity')
  if (firstOpportunity) redirect(withSaveToast(`/opportunities/${firstOpportunity.record_id}`, 'created'))
  const firstAccount = selections.find((s) => s.object_api === 'account')
  if (firstAccount) redirect(withSaveToast(`/accounts/${firstAccount.record_id}`, 'created'))
  const firstContact = selections.find((s) => s.object_api === 'contact')
  if (firstContact) redirect(withSaveToast(`/contacts/${firstContact.record_id}`, 'created'))
  const firstCustom = selections.find((s) => !['account', 'contact', 'opportunity'].includes(s.object_api))
  if (firstCustom) redirect(withSaveToast(recordHref(firstCustom.object_api, firstCustom.record_id), 'created'))
  redirect(withSaveToast(`/expenses/${row.id}`, 'created'))
}

/**
 * インライン編集用・部分更新。関連レコードには触れない（別途「関連」画面）。
 * 件名(title) は必須のため空送信時は更新しない。
 */
export async function updateExpenseBasic(id: string, formData: FormData) {
  await requirePermission('expenses', 'update')
  await assertNotPendingApproval('expenses', id)  // 承認待ち中は編集ロック（REQ-0023）
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('title') && (formData.get('title') as string)?.trim()) set.title = (formData.get('title') as string).trim()
  if (formData.has('amount')) {
    const a = formData.get('amount') as string
    if (a && Number(a) > 0) set.amount = String(Number(a))
  }
  if (formData.has('category'))     set.category = (formData.get('category') as string) || 'その他'
  if (formData.has('expense_date')) set.expense_date = (formData.get('expense_date') as string) || new Date().toISOString().slice(0, 10)
  if (formData.has('notes'))        set.notes = (formData.get('notes') as string) || null
  if (formData.has('vendor') || formData.has('tax_rate') || formData.has('invoice_reg_no')) {
    const receipt = parseReceiptFields(formData)
    if (formData.has('vendor'))         set.vendor = receipt.vendor
    if (formData.has('tax_rate'))       set.tax_rate = receipt.tax_rate
    if (formData.has('invoice_reg_no')) set.invoice_reg_no = receipt.invoice_reg_no
  }
  await db.update(expenses).set(set).where(eq(expenses.id, id))
  redirect(withSaveToast(`/expenses/${id}`, 'saved'))
}

export async function updateExpense(id: string, formData: FormData) {
  await requirePermission('expenses', 'update')
  await assertNotPendingApproval('expenses', id)  // 承認待ち中は編集ロック（REQ-0023）
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
    ...parseReceiptFields(formData),
    updated_at:   new Date(),
  }).where(eq(expenses.id, id))

  await syncExpenseRelatedRecords(id, selections)

  redirect(withSaveToast(`/expenses/${id}`, 'saved'))
}

/**
 * インラインコンポーザ用・その場で経費を作成（遷移せず revalidate のみ）。
 */
export async function quickCreateExpense(formData: FormData) {
  await requirePermission('expenses', 'create')
  const title = (formData.get('title') as string)?.trim()
  if (!title) throw new Error('件名は必須です')
  const amount = formData.get('amount') as string
  if (!amount || Number(amount) <= 0) throw new Error('金額は0より大きい値を入力してください')
  const [row] = await db.insert(expenses).values({
    title,
    amount: String(Number(amount)),
    category: (formData.get('category') as string) || 'その他',
    expense_date: (formData.get('expense_date') as string) || new Date().toISOString().slice(0, 10),
    notes: (formData.get('notes') as string)?.trim() || null,
  }).returning({ id: expenses.id })
  await syncExpenseRelatedRecords(row.id, parseRelatedRecords(formData))
  const revalidate = formData.get('revalidate') as string
  if (revalidate) revalidatePath(revalidate)
}

/** 関連レコードのインライン編集用・junction 同期のみ。 */
export async function updateExpenseRelatedRecords(id: string, formData: FormData) {
  await requirePermission('expenses', 'update')
  await assertNotPendingApproval('expenses', id)  // 承認待ち中は編集ロック（REQ-0023）
  await syncExpenseRelatedRecords(id, parseRelatedRecords(formData))
  redirect(withSaveToast(`/expenses/${id}`, 'saved'))
}

export async function deleteExpense(id: string, revalidate: string) {
  await requirePermission('expenses', 'delete')
  await assertNotPendingApproval('expenses', id)  // 承認待ち中は削除も不可（REQ-0023）
  await trashRecord('expenses', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  await db.delete(expenses).where(eq(expenses.id, id))
  revalidatePath(revalidate)
  revalidatePath('/expenses')
}
