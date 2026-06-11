'use server'

/**
 * 売上・請求（invoices）— staffing Phase5（REQ-0007 / #14）
 *
 * - 案件の確定内容から請求データを生成：請求額=発注単価（client_total_fee）、
 *   支払額=確定候補の提示単価合計、粗利=請求額−支払額（ADR-0010 固定単価モデル）
 * - 請求/支払ステータスの更新（請求済→billed_at、支払済→paid_at を自動記録）
 */
import { db } from '@/lib/db'
import { invoices, assignments, assignment_staff } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'

const BILLING_STATUSES = ['未請求', '請求済', '入金済']
const PAYMENT_STATUSES = ['未払', '支払済']

/** 案件の確定内容から請求データを生成（既存があれば金額を再計算して更新） */
export async function generateInvoice(assignmentId: string): Promise<void> {
  await requirePermission('assignments', 'update')

  const a = await db.select({ id: assignments.id, client_total_fee: assignments.client_total_fee })
    .from(assignments).where(eq(assignments.id, assignmentId)).then((r) => r[0] ?? null)
  if (!a) throw new Error('案件が見つかりません')

  const candidates = await db.select({ proposed_rate: assignment_staff.proposed_rate })
    .from(assignment_staff)
    .where(and(
      eq(assignment_staff.assignment_id, assignmentId),
      eq(assignment_staff.candidate_status, '確定'),
    ))
  const payment = candidates.reduce((acc, c) => acc + Number(c.proposed_rate ?? 0), 0)
  const billing = Number(a.client_total_fee ?? 0)
  const margin = billing - payment

  const existing = await db.select({ id: invoices.id, billing_status: invoices.billing_status })
    .from(invoices).where(eq(invoices.assignment_id, assignmentId)).then((r) => r[0] ?? null)

  if (existing) {
    if (existing.billing_status !== '未請求') {
      throw new Error('請求済みのため金額を再生成できません（ステータスを未請求に戻してから再生成してください）')
    }
    await db.update(invoices).set({
      billing_amount: String(billing),
      payment_amount: String(payment),
      margin:         String(margin),
    }).where(eq(invoices.id, existing.id))
  } else {
    await db.insert(invoices).values({
      assignment_id:  assignmentId,
      billing_amount: String(billing),
      payment_amount: String(payment),
      margin:         String(margin),
    })
  }

  revalidatePath(`/assignments/${assignmentId}`)
  revalidatePath('/invoices')
}

/** 請求/支払ステータスの更新 */
export async function updateInvoiceStatus(id: string, formData: FormData): Promise<void> {
  await requirePermission('assignments', 'update')
  const billing = (formData.get('billing_status') as string) ?? ''
  const payment = (formData.get('payment_status') as string) ?? ''
  if (!BILLING_STATUSES.includes(billing) || !PAYMENT_STATUSES.includes(payment)) {
    throw new Error('ステータスが不正です')
  }

  const cur = await db.select({ billed_at: invoices.billed_at, paid_at: invoices.paid_at, assignment_id: invoices.assignment_id })
    .from(invoices).where(eq(invoices.id, id)).then((r) => r[0] ?? null)
  if (!cur) throw new Error('請求データが見つかりません')

  await db.update(invoices).set({
    billing_status: billing,
    payment_status: payment,
    // 請求済/入金済 になった時刻・支払済になった時刻を自動記録（戻したらクリア）
    billed_at: billing === '未請求' ? null : (cur.billed_at ?? new Date()),
    paid_at:   payment === '支払済' ? (cur.paid_at ?? new Date()) : null,
  }).where(eq(invoices.id, id))

  if (cur.assignment_id) revalidatePath(`/assignments/${cur.assignment_id}`)
  revalidatePath('/invoices')
}

/** 請求データの削除（未請求のみ） */
export async function deleteInvoice(id: string): Promise<void> {
  await requirePermission('assignments', 'update')
  const cur = await db.select({ billing_status: invoices.billing_status, assignment_id: invoices.assignment_id })
    .from(invoices).where(eq(invoices.id, id)).then((r) => r[0] ?? null)
  if (!cur) return
  if (cur.billing_status !== '未請求') throw new Error('請求済みの請求データは削除できません')
  await db.delete(invoices).where(eq(invoices.id, id))
  if (cur.assignment_id) revalidatePath(`/assignments/${cur.assignment_id}`)
  revalidatePath('/invoices')
}
