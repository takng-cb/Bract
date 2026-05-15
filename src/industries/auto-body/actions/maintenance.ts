'use server'

import { db } from '@/lib/db'
import { maintenance_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { generateMaintenanceNo } from '@/industries/auto-body/lib/maintenanceNo'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

function pickInt(formData: FormData, key: string): number | null {
  const v = pick(formData, key)
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function createMaintenance(formData: FormData): Promise<string> {
  await requireEditor()

  const customer_vehicle_id = pick(formData, 'customer_vehicle_id')
  if (!customer_vehicle_id) throw new Error('顧客車両は必須です')
  const account_id = pick(formData, 'account_id')
  if (!account_id) throw new Error('顧客（取引先）は必須です')

  // UNIQUE 違反したら 5 回まで番号再採番（同時 INSERT 対策）
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await generateMaintenanceNo()
    try {
      const [row] = await db.insert(maintenance_records).values({
        maintenance_no:       no,
        customer_vehicle_id,
        account_id,
        contact_id:           pick(formData, 'contact_id'),
        billing_account_id:   pick(formData, 'billing_account_id'),
        intake_date:          pick(formData, 'intake_date'),
        intake_time:          pick(formData, 'intake_time'),
        delivery_date:        pick(formData, 'delivery_date'),
        delivery_time:        pick(formData, 'delivery_time'),
        pickup_location:      pick(formData, 'pickup_location'),
        delivery_location:    pick(formData, 'delivery_location'),
        sales_recording_date: pick(formData, 'sales_recording_date'),
        mileage:              pickInt(formData, 'mileage'),
        branch_id:            pick(formData, 'branch_id'),
        intake_category:      pick(formData, 'intake_category'),
        reception_owner_id:   pick(formData, 'reception_owner_id'),
        worker_owner_id:      pick(formData, 'worker_owner_id'),
        internal_memo:        pick(formData, 'internal_memo'),
        work_order_note:      pick(formData, 'work_order_note'),
        general_note:         pick(formData, 'general_note'),
        tax_mode:             pick(formData, 'tax_mode') ?? '税別10%',
        tax_rounding:         pick(formData, 'tax_rounding') ?? '切り捨て',
        lever_rate:           pick(formData, 'lever_rate'),
        status:               pick(formData, 'status') ?? '予約',
        owner_id:             pick(formData, 'owner_id'),
      }).returning({ id: maintenance_records.id })
      return row.id
    } catch (e) {
      lastErr = e
      // UNIQUE 違反のみリトライ
      const msg = e instanceof Error ? e.message : String(e)
      if (!/maintenance_no|unique|duplicate/i.test(msg)) throw e
    }
  }
  throw new Error('整備番号の採番に失敗しました（同時実行衝突）。再度お試しください。' + (lastErr ? ` (${(lastErr as Error).message})` : ''))
}

export async function updateMaintenance(id: string, formData: FormData) {
  await requireEditor()

  const customer_vehicle_id = pick(formData, 'customer_vehicle_id')
  if (!customer_vehicle_id) throw new Error('顧客車両は必須です')
  const account_id = pick(formData, 'account_id')
  if (!account_id) throw new Error('顧客（取引先）は必須です')

  await db.update(maintenance_records).set({
    customer_vehicle_id,
    account_id,
    contact_id:           pick(formData, 'contact_id'),
    billing_account_id:   pick(formData, 'billing_account_id'),
    intake_date:          pick(formData, 'intake_date'),
    intake_time:          pick(formData, 'intake_time'),
    delivery_date:        pick(formData, 'delivery_date'),
    delivery_time:        pick(formData, 'delivery_time'),
    pickup_location:      pick(formData, 'pickup_location'),
    delivery_location:    pick(formData, 'delivery_location'),
    sales_recording_date: pick(formData, 'sales_recording_date'),
    mileage:              pickInt(formData, 'mileage'),
    branch_id:            pick(formData, 'branch_id'),
    intake_category:      pick(formData, 'intake_category'),
    reception_owner_id:   pick(formData, 'reception_owner_id'),
    worker_owner_id:      pick(formData, 'worker_owner_id'),
    internal_memo:        pick(formData, 'internal_memo'),
    work_order_note:      pick(formData, 'work_order_note'),
    general_note:         pick(formData, 'general_note'),
    tax_mode:             pick(formData, 'tax_mode') ?? '税別10%',
    tax_rounding:         pick(formData, 'tax_rounding') ?? '切り捨て',
    lever_rate:           pick(formData, 'lever_rate'),
    status:               pick(formData, 'status') ?? '予約',
    owner_id:             pick(formData, 'owner_id'),
    updated_at:           new Date(),
  }).where(eq(maintenance_records.id, id))

  redirect(`/maintenance/${id}`)
}

export async function deleteMaintenance(id: string) {
  await requireEditor()
  await db.delete(maintenance_records).where(eq(maintenance_records.id, id))
  revalidatePath('/maintenance')
  redirect('/maintenance')
}

export async function updateMaintenanceStatus(id: string, status: string) {
  await requireEditor()
  await db.update(maintenance_records)
    .set({ status, updated_at: new Date() })
    .where(eq(maintenance_records.id, id))
  revalidatePath(`/maintenance/${id}`)
}
