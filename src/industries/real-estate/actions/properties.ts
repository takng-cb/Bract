'use server'


import { requirePermission } from '@/lib/permissions'
import { trashRecord } from '@/lib/trash'
import { db } from '@/lib/db'
import { properties } from '@/industries/real-estate/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { assertNotPendingApproval } from '@/app/actions/approvals'
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
  await requirePermission('properties', 'create')
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  const [row] = await db.insert(properties).values(data).returning()
  // book_records ミラー（activities/tasks/expenses 等の関連先表示用）
  await syncPropertyToCustomRecord(row)
  revalidatePath('/properties')
  return row.id
}

/**
 * インライン編集用・部分更新。送信されたフィールドだけを更新する（formData.has 判定）。
 * 概要カード／登記カード／司法書士カードのどれを保存しても他カードの値を消さない。
 * book_records ミラーは全保存で再同期する（関連表示の整合を保つ）。
 */
export async function updatePropertyBasic(id: string, formData: FormData) {
  await requirePermission('properties', 'update')
  await assertNotPendingApproval('properties', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  const raw    = (k: string) => (formData.get(k) as string | null) ?? ''
  const numStr = (k: string) => { const v = raw(k); return v ? String(Number(v)) : null }
  const set: Record<string, unknown> = { updated_at: new Date() }

  // 文字列（空＝null）
  const TEXT_FIELDS = [
    'account_id', 'contact_id',
    'seller_scrivener_account_id', 'seller_scrivener_contact_id',
    'buyer_scrivener_account_id', 'buyer_scrivener_contact_id',
    'land_fudosan_number', 'address', 'land_chiban', 'chimoku', 'land_cause',
    'land_owner_name', 'land_owner_address', 'land_acquisition_reason',
    'building_fudosan_number', 'building_location', 'building_kaoku_number',
    'building_shurui', 'structure',
    'building_owner_name', 'building_owner_address', 'building_acquisition_reason',
    'building_lien_type', 'building_lien_holder', 'building_joint_collateral_number',
    'description',
  ] as const
  // 数値（文字列化して保持）
  const NUM_FIELDS = ['price', 'area', 'building_floor_area_1f', 'building_floor_area_2f', 'building_floor_area_3f', 'building_damage_rate'] as const
  // 日付（空＝null）
  const DATE_FIELDS = ['land_acquisition_date', 'land_seizure_release_date', 'building_new_construction_date', 'building_acquisition_date', 'building_seizure_release_date'] as const
  // 真偽（select で 'on'＝あり）
  const BOOL_FIELDS = ['land_seizure', 'building_seizure'] as const

  for (const k of TEXT_FIELDS) if (formData.has(k)) set[k] = raw(k) || null
  for (const k of NUM_FIELDS)  if (formData.has(k)) set[k] = numStr(k)
  for (const k of DATE_FIELDS) if (formData.has(k)) set[k] = raw(k) || null
  for (const k of BOOL_FIELDS) if (formData.has(k)) set[k] = raw(k) === 'on'
  if (formData.has('property_type'))    set.property_type    = raw('property_type') || 'その他'
  if (formData.has('transaction_type')) set.transaction_type = raw('transaction_type') || '売買'
  if (formData.has('building_debt_amount')) set.building_debt_amount = raw('building_debt_amount') ? Number(raw('building_debt_amount')) : null

  const [row] = await db.update(properties).set(set).where(eq(properties.id, id)).returning()
  if (row) await syncPropertyToCustomRecord(row)
  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}`)
}

export async function updateProperty(id: string, formData: FormData) {
  await requirePermission('properties', 'update')
  await assertNotPendingApproval('properties', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  const [row] = await db.update(properties)
    .set({ ...data, updated_at: new Date() })
    .where(eq(properties.id, id))
    .returning()
  // book_records ミラーを更新
  if (row) await syncPropertyToCustomRecord(row)
  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}`)
}

/** ステータスのみ更新（矢羽根 StageBar 用）。book_records ミラーも同期 */
export async function setPropertyStatus(id: string, status: string) {
  await requirePermission('properties', 'update')
  await assertNotPendingApproval('properties', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  const [row] = await db.update(properties)
    .set({ status, updated_at: new Date() })
    .where(eq(properties.id, id))
    .returning()
  if (row) await syncPropertyToCustomRecord(row)
  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
}

export async function deleteProperty(id: string) {
  await requirePermission('properties', 'delete')
  await assertNotPendingApproval('properties', id)  // 承認待ち中は削除も不可（REQ-0023 / #131）
  await trashRecord('properties', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  await db.delete(properties).where(eq(properties.id, id))
  // book_records ミラー側も削除
  await deletePropertyCustomRecord(id)
  revalidatePath('/properties')
  redirect('/properties')
}
