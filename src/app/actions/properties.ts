'use server'

import { db } from '@/lib/db'
import { properties } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function parseForm(formData: FormData) {
  const raw = (k: string) => (formData.get(k) as string | null) ?? ''
  return {
    name:             raw('name'),
    property_type:    raw('property_type') || 'その他',
    transaction_type: raw('transaction_type') || '売買',
    status:           raw('status') || '募集中',
    address:          raw('address') || null,
    area:             raw('area') ? String(Number(raw('area'))) : null,
    price:            raw('price') ? String(Number(raw('price'))) : null,
    floor:            raw('floor') ? Number(raw('floor')) : null,
    total_floors:     raw('total_floors') ? Number(raw('total_floors')) : null,
    built_year:       raw('built_year') ? Number(raw('built_year')) : null,
    account_id:       raw('account_id') || null,
    contact_id:       raw('contact_id') || null,
    description:      raw('description') || null,
  }
}

export async function createProperty(formData: FormData) {
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  const [row] = await db.insert(properties).values(data).returning({ id: properties.id })
  revalidatePath('/properties')
  redirect(`/properties/${row.id}`)
}

export async function updateProperty(id: string, formData: FormData) {
  const data = parseForm(formData)
  if (!data.name) throw new Error('物件名は必須です')
  await db.update(properties).set({ ...data, updated_at: new Date() }).where(eq(properties.id, id))
  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}`)
}

export async function deleteProperty(id: string) {
  await db.delete(properties).where(eq(properties.id, id))
  revalidatePath('/properties')
  redirect('/properties')
}
