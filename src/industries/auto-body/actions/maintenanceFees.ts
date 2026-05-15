'use server'

import { db } from '@/lib/db'
import { maintenance_fees } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

async function nextSortOrder(maintenanceId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`COALESCE(MAX(${maintenance_fees.sort_order}), -1)` })
    .from(maintenance_fees)
    .where(eq(maintenance_fees.maintenance_id, maintenanceId))
  return Number(rows[0]?.max ?? -1) + 1
}

export async function createFee(maintenanceId: string, formData: FormData) {
  await requireEditor()
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('項目名は必須です')
  const category = pick(formData, 'category') ?? '課税'
  if (category !== '課税' && category !== '非課税') throw new Error('区分は 課税 / 非課税 のいずれかです')

  const sort_order = await nextSortOrder(maintenanceId)

  await db.insert(maintenance_fees).values({
    maintenance_id: maintenanceId,
    sort_order,
    category,
    item_name,
    amount:      pick(formData, 'amount'),
    cost_amount: pick(formData, 'cost_amount'),
  })

  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function updateFee(maintenanceId: string, feeId: string, formData: FormData) {
  await requireEditor()
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('項目名は必須です')
  const category = pick(formData, 'category') ?? '課税'
  if (category !== '課税' && category !== '非課税') throw new Error('区分は 課税 / 非課税 のいずれかです')

  await db.update(maintenance_fees).set({
    category,
    item_name,
    amount:      pick(formData, 'amount'),
    cost_amount: pick(formData, 'cost_amount'),
  }).where(eq(maintenance_fees.id, feeId))

  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function deleteFee(maintenanceId: string, feeId: string) {
  await requireEditor()
  await db.delete(maintenance_fees).where(eq(maintenance_fees.id, feeId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}
