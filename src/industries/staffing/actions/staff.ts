'use server'

/**
 * staff (スタッフマスタ) CRUD アクション (Issue #69)
 */
import { db } from '@/lib/db'
import { staff } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

function pickJsonArray(formData: FormData, key: string): string[] | null {
  const v = pick(formData, key)
  if (!v) return null
  // カンマ区切りで分割
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

export async function createStaff(formData: FormData): Promise<string> {
  await requireEditor()

  const name = pick(formData, 'name')
  if (!name) throw new Error('氏名は必須です')

  const [row] = await db.insert(staff).values({
    name,
    name_kana:             pick(formData, 'name_kana'),
    belong_account_id:     pick(formData, 'belong_account_id'),
    gender:                pick(formData, 'gender'),
    birth_date:            pick(formData, 'birth_date'),
    phone:                 pick(formData, 'phone'),
    email:                 pick(formData, 'email'),
    skills:                pickJsonArray(formData, 'skills'),
    available_areas:       pickJsonArray(formData, 'available_areas'),
    default_hourly_rate:   pick(formData, 'default_hourly_rate'),
    default_cost_per_hour: pick(formData, 'default_cost_per_hour'),
    photo_url:             pick(formData, 'photo_url'),
    status:                pick(formData, 'status') ?? '稼働中',
    notes:                 pick(formData, 'notes'),
    owner_id:              pick(formData, 'owner_id'),
  }).returning({ id: staff.id })

  revalidatePath('/staff')
  return row.id
}

/** プロフィールカードのインライン編集用・部分更新（氏名/スキル/単価/ステータスには触れない）。 */
export async function updateStaffBasic(id: string, formData: FormData) {
  await requireEditor()
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('gender'))     set.gender = pick(formData, 'gender')
  if (formData.has('birth_date')) set.birth_date = pick(formData, 'birth_date')
  if (formData.has('phone'))      set.phone = pick(formData, 'phone')
  if (formData.has('email'))      set.email = pick(formData, 'email')
  await db.update(staff).set(set).where(eq(staff.id, id))
  redirect(`/staff/${id}`)
}

export async function updateStaff(id: string, formData: FormData) {
  await requireEditor()

  const name = pick(formData, 'name')
  if (!name) throw new Error('氏名は必須です')

  await db.update(staff).set({
    name,
    name_kana:             pick(formData, 'name_kana'),
    belong_account_id:     pick(formData, 'belong_account_id'),
    gender:                pick(formData, 'gender'),
    birth_date:            pick(formData, 'birth_date'),
    phone:                 pick(formData, 'phone'),
    email:                 pick(formData, 'email'),
    skills:                pickJsonArray(formData, 'skills'),
    available_areas:       pickJsonArray(formData, 'available_areas'),
    default_hourly_rate:   pick(formData, 'default_hourly_rate'),
    default_cost_per_hour: pick(formData, 'default_cost_per_hour'),
    photo_url:             pick(formData, 'photo_url'),
    status:                pick(formData, 'status') ?? '稼働中',
    notes:                 pick(formData, 'notes'),
    owner_id:              pick(formData, 'owner_id'),
    updated_at:            new Date(),
  }).where(eq(staff.id, id))

  redirect(`/staff/${id}`)
}

/** ステータスのみ更新（矢羽根 StageBar 用） */
export async function setStaffStatus(id: string, status: string) {
  await requireEditor()
  await db.update(staff).set({ status, updated_at: new Date() }).where(eq(staff.id, id))
  revalidatePath(`/staff/${id}`)
  revalidatePath('/staff')
}

export async function deleteStaff(id: string) {
  await requireEditor()
  await db.delete(staff).where(eq(staff.id, id))
  revalidatePath('/staff')
  redirect('/staff')
}
