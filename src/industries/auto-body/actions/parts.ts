'use server'

import { db } from '@/lib/db'
import { parts, part_movements } from '@/industries/auto-body/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { MOVEMENT_TYPES } from '@/industries/auto-body/lib/partsHelpers'
import { requirePermission } from '@/lib/permissions'

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function n(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const num = Number(v)
  return Number.isFinite(num) ? String(num) : null
}
function i(formData: FormData, key: string): number | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const num = Number(v)
  return Number.isFinite(num) ? Math.round(num) : null
}

export async function createPart(formData: FormData): Promise<string> {
  await requirePermission('parts', 'create')
  const partNumber = s(formData, 'part_number')
  const name       = s(formData, 'name')
  if (!partNumber) throw new Error('品番は必須です')
  if (!name)       throw new Error('部品名は必須です')

  const [row] = await db.insert(parts).values({
    part_number:         partNumber,
    name,
    category:            s(formData, 'category'),
    supplier_account_id: s(formData, 'supplier_account_id'),
    unit_price:          n(formData, 'unit_price'),
    description:         s(formData, 'description'),
    reorder_level:       i(formData, 'reorder_level') ?? 0,
    owner_id:            s(formData, 'owner_id'),
  }).returning({ id: parts.id })

  revalidatePath('/parts')
  return row.id
}

export async function updatePart(id: string, formData: FormData) {
  await requirePermission('parts', 'update')
  const partNumber = s(formData, 'part_number')
  const name       = s(formData, 'name')
  if (!partNumber) throw new Error('品番は必須です')
  if (!name)       throw new Error('部品名は必須です')

  await db.update(parts).set({
    part_number:         partNumber,
    name,
    category:            s(formData, 'category'),
    supplier_account_id: s(formData, 'supplier_account_id'),
    unit_price:          n(formData, 'unit_price'),
    description:         s(formData, 'description'),
    reorder_level:       i(formData, 'reorder_level') ?? 0,
    owner_id:            s(formData, 'owner_id'),
    updated_at:          new Date(),
  }).where(eq(parts.id, id))

  revalidatePath('/parts')
  revalidatePath(`/parts/${id}`)
  redirect(`/parts/${id}`)
}

/**
 * インライン編集用・部分更新。送信されたフィールドだけ更新（formData.has 判定）。
 * 品番(part_number)/部品名(name) は必須のため空送信時は更新しない。
 */
export async function updatePartBasic(id: string, formData: FormData) {
  await requirePermission('parts', 'update')
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('category'))            set.category = s(formData, 'category')
  if (formData.has('supplier_account_id')) set.supplier_account_id = s(formData, 'supplier_account_id')
  if (formData.has('unit_price'))          set.unit_price = n(formData, 'unit_price')
  if (formData.has('reorder_level'))       set.reorder_level = i(formData, 'reorder_level') ?? 0
  if (formData.has('description'))         set.description = s(formData, 'description')
  if (formData.has('part_number') && s(formData, 'part_number')) set.part_number = s(formData, 'part_number')
  if (formData.has('name') && s(formData, 'name'))               set.name = s(formData, 'name')
  await db.update(parts).set(set).where(eq(parts.id, id))
  revalidatePath('/parts')
  revalidatePath(`/parts/${id}`)
  redirect(`/parts/${id}`)
}

export async function deletePart(id: string) {
  await requirePermission('parts', 'delete')
  await db.delete(parts).where(eq(parts.id, id))  // cascade で part_movements も削除
  revalidatePath('/parts')
  redirect('/parts')
}

// ── 入出庫 ───────────────────────────────────────────────
export async function createPartMovement(formData: FormData): Promise<void> {
  await requirePermission('parts', 'create')
  const partId       = s(formData, 'part_id')
  const movementType = s(formData, 'movement_type')
  const quantityRaw  = i(formData, 'quantity')
  if (!partId)        throw new Error('part_id は必須です')
  if (!movementType || !(MOVEMENT_TYPES as readonly string[]).includes(movementType)) {
    throw new Error('入出庫種別が不正です')
  }
  if (quantityRaw == null) throw new Error('数量は必須です')

  await db.insert(part_movements).values({
    part_id:        partId,
    movement_type:  movementType,
    quantity:       quantityRaw,
    unit_price:     n(formData, 'unit_price'),
    occurred_at:    s(formData, 'occurred_at') ?? new Date().toISOString().slice(0, 10),
    opportunity_id: s(formData, 'opportunity_id'),
    vehicle_id:     s(formData, 'vehicle_id'),
    notes:          s(formData, 'notes'),
    owner_id:       s(formData, 'owner_id'),
  })

  revalidatePath('/parts')
  revalidatePath(`/parts/${partId}`)
}

export async function deletePartMovement(id: string, partId: string): Promise<void> {
  await requirePermission('parts', 'delete')
  await db.delete(part_movements).where(eq(part_movements.id, id))
  revalidatePath(`/parts/${partId}`)
}
