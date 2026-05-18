'use server'

/**
 * 顧客車両（customer_vehicles）の CRUD server action。
 * 既存 vehicles（在庫車両・売り物）と別物。整備対象として顧客が持ち込む車。
 */
import { db } from '@/lib/db'
import { customer_vehicles, maintenance_records } from '@/lib/schema'
import { eq, count } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function pickField(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

export async function createCustomerVehicle(formData: FormData): Promise<string> {
  await requireEditor()

  const account_id = pickField(formData, 'account_id')
  const contact_id = pickField(formData, 'contact_id')
  // BtoB は account_id、BtoC は contact_id。どちらか必須。
  if (!account_id && !contact_id) {
    throw new Error('顧客（取引先または人物）は必須です')
  }

  const [row] = await db.insert(customer_vehicles).values({
    account_id,
    contact_id,
    transport_branch:         pickField(formData, 'transport_branch'),
    classification_number:    pickField(formData, 'classification_number'),
    kana:                     pickField(formData, 'kana'),
    plate_number:             pickField(formData, 'plate_number'),
    car_name:                 pickField(formData, 'car_name'),
    car_model:                pickField(formData, 'car_model'),
    grade:                    pickField(formData, 'grade'),
    vehicle_kind:             pickField(formData, 'vehicle_kind'),
    vehicle_usage:            pickField(formData, 'vehicle_usage'),
    private_business:         pickField(formData, 'private_business'),
    body_shape:               pickField(formData, 'body_shape'),
    vin:                      pickField(formData, 'vin'),
    type_designation:         pickField(formData, 'type_designation'),
    class_category:           pickField(formData, 'class_category'),
    first_registration_year:  pickField(formData, 'first_registration_year'),
    first_registration_month: pickField(formData, 'first_registration_month'),
    inspection_due_date:      pickField(formData, 'inspection_due_date'),
    memo:                     pickField(formData, 'memo'),
    owner_id:                 pickField(formData, 'owner_id'),
  }).returning({ id: customer_vehicles.id })

  return row.id
}

export async function updateCustomerVehicle(id: string, formData: FormData) {
  await requireEditor()

  const account_id = pickField(formData, 'account_id')
  const contact_id = pickField(formData, 'contact_id')
  if (!account_id && !contact_id) {
    throw new Error('顧客（取引先または人物）は必須です')
  }

  await db.update(customer_vehicles).set({
    account_id,
    contact_id,
    transport_branch:         pickField(formData, 'transport_branch'),
    classification_number:    pickField(formData, 'classification_number'),
    kana:                     pickField(formData, 'kana'),
    plate_number:             pickField(formData, 'plate_number'),
    car_name:                 pickField(formData, 'car_name'),
    car_model:                pickField(formData, 'car_model'),
    grade:                    pickField(formData, 'grade'),
    vehicle_kind:             pickField(formData, 'vehicle_kind'),
    vehicle_usage:            pickField(formData, 'vehicle_usage'),
    private_business:         pickField(formData, 'private_business'),
    body_shape:               pickField(formData, 'body_shape'),
    vin:                      pickField(formData, 'vin'),
    type_designation:         pickField(formData, 'type_designation'),
    class_category:           pickField(formData, 'class_category'),
    first_registration_year:  pickField(formData, 'first_registration_year'),
    first_registration_month: pickField(formData, 'first_registration_month'),
    inspection_due_date:      pickField(formData, 'inspection_due_date'),
    memo:                     pickField(formData, 'memo'),
    owner_id:                 pickField(formData, 'owner_id'),
    updated_at:               new Date(),
  }).where(eq(customer_vehicles.id, id))

  redirect(`/customer-vehicles/${id}`)
}

export async function deleteCustomerVehicle(id: string) {
  await requireEditor()

  // 関連する整備が残っている場合は削除を拒否（FK ON DELETE RESTRICT）
  const [mc] = await db.select({ c: count() }).from(maintenance_records)
    .where(eq(maintenance_records.customer_vehicle_id, id))
  if (Number(mc?.c ?? 0) > 0) {
    throw new Error('この車両には整備履歴が残っているため削除できません。先に該当整備を削除してください。')
  }

  await db.delete(customer_vehicles).where(eq(customer_vehicles.id, id))
  revalidatePath('/customer-vehicles')
  redirect('/customer-vehicles')
}
