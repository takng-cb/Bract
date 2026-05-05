'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import { properties } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function parseForm(formData: FormData) {
  const raw      = (k: string) => (formData.get(k) as string | null) ?? ''
  const category = raw('product_category') || 'real_estate'
  const isRE     = category === 'real_estate'
  return {
    product_category: category,
    name:             raw('name'),
    property_type:    isRE ? (raw('property_type') || 'その他') : 'その他',
    transaction_type: raw('transaction_type') || (isRE ? '売買' : 'その他'),
    status:           raw('status') || (isRE ? '募集中' : '提案中'),
    address:          isRE ? (raw('address') || null) : null,
    area:             isRE && raw('area') ? String(Number(raw('area'))) : null,
    price:            raw('price') ? String(Number(raw('price'))) : null,
    floor:            isRE && raw('floor') ? Number(raw('floor')) : null,
    total_floors:     isRE && raw('total_floors') ? Number(raw('total_floors')) : null,
    built_year:       isRE && raw('built_year') ? Number(raw('built_year')) : null,
    account_id:       raw('account_id') || null,
    contact_id:       raw('contact_id') || null,
    seller_scrivener_account_id: isRE ? (raw('seller_scrivener_account_id') || null) : null,
    seller_scrivener_contact_id: isRE ? (raw('seller_scrivener_contact_id') || null) : null,
    buyer_scrivener_account_id:  isRE ? (raw('buyer_scrivener_account_id')  || null) : null,
    buyer_scrivener_contact_id:  isRE ? (raw('buyer_scrivener_contact_id')  || null) : null,
    // 土地の登記
    chimoku:       isRE ? (raw('chimoku')       || null) : null,
    land_chiban:   isRE ? (raw('land_chiban')   || null) : null,
    rights_status: isRE ? (raw('rights_status') || null) : null,
    // 建物の登記
    structure:              isRE ? (raw('structure')              || null) : null,
    building_kaoku_number:  isRE ? (raw('building_kaoku_number')  || null) : null,
    building_shurui:        isRE ? (raw('building_shurui')        || null) : null,
    building_floor_area:    isRE && raw('building_floor_area') ? String(Number(raw('building_floor_area'))) : null,
    description:      raw('description') || null,
  }
}

export async function createProperty(formData: FormData) {
  await requireEditor()
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  const [row] = await db.insert(properties).values(data).returning({ id: properties.id })
  revalidatePath('/properties')
  redirect(`/properties/${row.id}`)
}

export async function updateProperty(id: string, formData: FormData) {
  await requireEditor()
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  await db.update(properties).set({ ...data, updated_at: new Date() }).where(eq(properties.id, id))
  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}`)
}

export async function deleteProperty(id: string) {
  await requireEditor()
  await db.delete(properties).where(eq(properties.id, id))
  revalidatePath('/properties')
  redirect('/properties')
}
