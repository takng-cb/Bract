'use server'

import { db } from '@/lib/db'
import { maintenance_fees } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { calcCaliPremium, CALI_CLASS_LABEL, type CaliVehicleClass } from '@/industries/auto-body/lib/caliInsurance'

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

/**
 * 自賠責保険料を自動計算して諸費用(非課税)に追加する（Issue #47）。
 * 料率は公定（calcCaliPremium）。期間は 12/13/24/25/36/37 ヶ月。
 */
export async function addCaliInsuranceFee(maintenanceId: string, vehicleClass: CaliVehicleClass, months: number) {
  await requireEditor()
  const r = calcCaliPremium({ vehicleClass, months })
  if (!r) throw new Error('該当する自賠責料率がありません（期間は 12/13/24/25/36/37 ヶ月から選択）')
  const sort_order = await nextSortOrder(maintenanceId)
  await db.insert(maintenance_fees).values({
    maintenance_id: maintenanceId,
    sort_order,
    category:  '非課税',  // 自賠責保険は非課税
    item_name: `自賠責保険（${CALI_CLASS_LABEL[vehicleClass]}・${months}ヶ月）`,
    amount:    String(r.premium),
    meta:      { kind: 'cali', months, vehicleClass, revision: r.revision, premium: r.premium },
  })
  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function deleteFee(maintenanceId: string, feeId: string) {
  await requireEditor()
  await db.delete(maintenance_fees).where(eq(maintenance_fees.id, feeId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}
