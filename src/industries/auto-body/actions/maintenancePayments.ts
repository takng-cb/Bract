'use server'

import { db } from '@/lib/db'
import { maintenance_payments } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

export async function createPayment(maintenanceId: string, formData: FormData) {
  await requirePermission('maintenance_records', 'create')
  const payment_method = pick(formData, 'payment_method')
  if (!payment_method) throw new Error('支払方法は必須です')
  const amount = pick(formData, 'amount')
  if (!amount) throw new Error('金額は必須です')
  const payment_date = pick(formData, 'payment_date')
  if (!payment_date) throw new Error('入金日は必須です')

  await db.insert(maintenance_payments).values({
    maintenance_id: maintenanceId,
    payment_method,
    memo:           pick(formData, 'memo'),
    amount,
    payment_date,
    owner_id:       pick(formData, 'owner_id'),
    branch_id:      pick(formData, 'branch_id'),
  })

  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function updatePayment(maintenanceId: string, paymentId: string, formData: FormData) {
  await requirePermission('maintenance_records', 'update')
  const payment_method = pick(formData, 'payment_method')
  if (!payment_method) throw new Error('支払方法は必須です')
  const amount = pick(formData, 'amount')
  if (!amount) throw new Error('金額は必須です')
  const payment_date = pick(formData, 'payment_date')
  if (!payment_date) throw new Error('入金日は必須です')

  await db.update(maintenance_payments).set({
    payment_method,
    memo:           pick(formData, 'memo'),
    amount,
    payment_date,
    owner_id:       pick(formData, 'owner_id'),
    branch_id:      pick(formData, 'branch_id'),
  }).where(eq(maintenance_payments.id, paymentId))

  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function deletePayment(maintenanceId: string, paymentId: string) {
  await requirePermission('maintenance_records', 'delete')
  await db.delete(maintenance_payments).where(eq(maintenance_payments.id, paymentId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}
