'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import { properties } from '@/industries/real-estate/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  syncPropertyToCustomRecord,
  deletePropertyCustomRecord,
} from '@/industries/real-estate/lib/propertyCustomRecordSync'

function parseForm(formData: FormData) {
  const raw    = (k: string) => (formData.get(k) as string | null) ?? ''
  const numStr = (k: string) => { const v = raw(k); return v ? String(Number(v)) : null }
  const dt     = (k: string) => raw(k) || null
  const bool   = (k: string) => raw(k) === 'on'

  const category = raw('product_category') || 'real_estate'
  const isRE     = category === 'real_estate'
  return {
    product_category: category,
    name:             raw('name'),
    property_type:    isRE ? (raw('property_type') || 'その他') : 'その他',
    transaction_type: raw('transaction_type') || (isRE ? '売買' : 'その他'),
    status:           raw('status') || (isRE ? '募集中' : '提案中'),
    price:            numStr('price'),
    account_id:       raw('account_id') || null,
    contact_id:       raw('contact_id') || null,
    seller_scrivener_account_id: isRE ? (raw('seller_scrivener_account_id') || null) : null,
    seller_scrivener_contact_id: isRE ? (raw('seller_scrivener_contact_id') || null) : null,
    buyer_scrivener_account_id:  isRE ? (raw('buyer_scrivener_account_id')  || null) : null,
    buyer_scrivener_contact_id:  isRE ? (raw('buyer_scrivener_contact_id')  || null) : null,
    // ─── 土地の登記 ─── 表題部
    land_fudosan_number: isRE ? (raw('land_fudosan_number') || null) : null,
    address:             isRE ? (raw('address')             || null) : null,
    land_chiban:         isRE ? (raw('land_chiban')         || null) : null,
    chimoku:             isRE ? (raw('chimoku')             || null) : null,
    area:                isRE ? numStr('area')                       : null,
    land_cause:          isRE ? (raw('land_cause')          || null) : null,
    // ─── 土地の登記 ─── 甲区
    land_owner_name:           isRE ? (raw('land_owner_name')         || null) : null,
    land_owner_address:        isRE ? (raw('land_owner_address')      || null) : null,
    land_acquisition_reason:   isRE ? (raw('land_acquisition_reason') || null) : null,
    land_acquisition_date:     isRE ? dt('land_acquisition_date')             : null,
    land_seizure:              isRE ? bool('land_seizure')                    : false,
    land_seizure_release_date: isRE ? dt('land_seizure_release_date')         : null,
    // ─── 建物の登記 ─── 表題部
    building_fudosan_number:        isRE ? (raw('building_fudosan_number')  || null) : null,
    building_location:              isRE ? (raw('building_location')        || null) : null,
    building_kaoku_number:          isRE ? (raw('building_kaoku_number')    || null) : null,
    building_shurui:                isRE ? (raw('building_shurui')          || null) : null,
    structure:                      isRE ? (raw('structure')                || null) : null,
    building_floor_area_1f:         isRE ? numStr('building_floor_area_1f')         : null,
    building_floor_area_2f:         isRE ? numStr('building_floor_area_2f')         : null,
    building_floor_area_3f:         isRE ? numStr('building_floor_area_3f')         : null,
    building_new_construction_date: isRE ? dt('building_new_construction_date')     : null,
    // ─── 建物の登記 ─── 甲区
    building_owner_name:           isRE ? (raw('building_owner_name')         || null) : null,
    building_owner_address:        isRE ? (raw('building_owner_address')      || null) : null,
    building_acquisition_reason:   isRE ? (raw('building_acquisition_reason') || null) : null,
    building_acquisition_date:     isRE ? dt('building_acquisition_date')             : null,
    building_seizure:              isRE ? bool('building_seizure')                    : false,
    building_seizure_release_date: isRE ? dt('building_seizure_release_date')         : null,
    // ─── 建物の登記 ─── 乙区
    building_lien_type:               isRE ? (raw('building_lien_type')               || null) : null,
    building_lien_holder:             isRE ? (raw('building_lien_holder')             || null) : null,
    building_debt_amount:             isRE && raw('building_debt_amount') ? Number(raw('building_debt_amount')) : null,
    building_damage_rate:             isRE ? numStr('building_damage_rate')                     : null,
    building_joint_collateral_number: isRE ? (raw('building_joint_collateral_number') || null) : null,
    description: raw('description') || null,
  }
}

export async function createProperty(formData: FormData): Promise<string> {
  await requireEditor()
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  const [row] = await db.insert(properties).values(data).returning()
  // custom_records ミラー（activities/tasks/expenses 等の関連先表示用）
  await syncPropertyToCustomRecord(row)
  revalidatePath('/properties')
  return row.id
}

export async function updateProperty(id: string, formData: FormData) {
  await requireEditor()
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  const [row] = await db.update(properties)
    .set({ ...data, updated_at: new Date() })
    .where(eq(properties.id, id))
    .returning()
  // custom_records ミラーを更新
  if (row) await syncPropertyToCustomRecord(row)
  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}`)
}

export async function deleteProperty(id: string) {
  await requireEditor()
  await db.delete(properties).where(eq(properties.id, id))
  // custom_records ミラー側も削除
  await deletePropertyCustomRecord(id)
  revalidatePath('/properties')
  redirect('/properties')
}
