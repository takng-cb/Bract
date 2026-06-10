'use server'

import { db } from '@/lib/db'
import { maintenance_line_items, part_movements } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

function pickBool(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true'
}

function pickInt(formData: FormData, key: string): number | null {
  const v = pick(formData, key)
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

async function nextSortOrder(maintenanceId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`COALESCE(MAX(${maintenance_line_items.sort_order}), -1)` })
    .from(maintenance_line_items)
    .where(eq(maintenance_line_items.maintenance_id, maintenanceId))
  return Number(rows[0]?.max ?? -1) + 1
}

export async function createLineItem(maintenanceId: string, formData: FormData) {
  await requireEditor()
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('作業項目名は必須です')

  const sort_order = await nextSortOrder(maintenanceId)
  const part_id  = pick(formData, 'part_id')
  const partsQty = pickInt(formData, 'parts_qty')

  const [inserted] = await db.insert(maintenance_line_items).values({
    maintenance_id:   maintenanceId,
    sort_order,
    work_category:    pick(formData, 'work_category'),
    item_name,
    hours:            pick(formData, 'hours'),
    labor_amount:     pick(formData, 'labor_amount'),
    parts_qty:        pick(formData, 'parts_qty'),
    parts_unit:       pick(formData, 'parts_unit'),
    parts_unit_price: pick(formData, 'parts_unit_price'),
    cost_unit_price:  pick(formData, 'cost_unit_price'),
    part_id,
    note:             pick(formData, 'note'),
    state:            pick(formData, 'state'),
    is_excluded:      pickBool(formData, 'is_excluded'),
    work_status:      pick(formData, 'work_status') ?? '未完了',
  }).returning({ id: maintenance_line_items.id })

  // 部品マスタとリンク + 数量があれば、自動で「出庫」part_movement を生成
  // (Issue #47 Phase 2)
  if (part_id && partsQty != null && partsQty > 0 && inserted) {
    await db.insert(part_movements).values({
      part_id,
      movement_type:  '出庫',
      quantity:       partsQty,
      unit_price:     pick(formData, 'cost_unit_price'),
      occurred_at:    new Date().toISOString().slice(0, 10),
      maintenance_id: maintenanceId,
      line_item_id:   inserted.id,
      notes:          `[自動] 整備 ${item_name} で使用`,
    })
  }

  revalidatePath(`/maintenance/${maintenanceId}`)
  revalidatePath('/parts')
}

export async function updateLineItem(maintenanceId: string, lineId: string, formData: FormData) {
  await requireEditor()
  const item_name = pick(formData, 'item_name')
  if (!item_name) throw new Error('作業項目名は必須です')

  await db.update(maintenance_line_items).set({
    work_category:    pick(formData, 'work_category'),
    item_name,
    hours:            pick(formData, 'hours'),
    labor_amount:     pick(formData, 'labor_amount'),
    parts_qty:        pick(formData, 'parts_qty'),
    parts_unit:       pick(formData, 'parts_unit'),
    parts_unit_price: pick(formData, 'parts_unit_price'),
    cost_unit_price:  pick(formData, 'cost_unit_price'),
    part_id:          pick(formData, 'part_id'),
    note:             pick(formData, 'note'),
    state:            pick(formData, 'state'),
    is_excluded:      pickBool(formData, 'is_excluded'),
    work_status:      pick(formData, 'work_status') ?? '未完了',
  }).where(eq(maintenance_line_items.id, lineId))

  // 部品リンク変更時の自動同期は複雑になるので、v1 では未対応。
  // ユーザーが /parts/[id] で part_movements を手動調整する想定。
  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function deleteLineItem(maintenanceId: string, lineId: string) {
  await requireEditor()

  // この行に紐づく自動生成された part_movement があれば併せて削除
  // (Issue #47 Phase 2)
  await db.delete(part_movements).where(eq(part_movements.line_item_id, lineId))

  await db.delete(maintenance_line_items).where(eq(maintenance_line_items.id, lineId))
  revalidatePath(`/maintenance/${maintenanceId}`)
  revalidatePath('/parts')
}

export async function toggleLineWorkStatus(maintenanceId: string, lineId: string, completed: boolean) {
  await requireEditor()
  await db.update(maintenance_line_items)
    .set({ work_status: completed ? '完了' : '未完了' })
    .where(eq(maintenance_line_items.id, lineId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}
