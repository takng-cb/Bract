'use server'

import { db } from '@/lib/db'
import { maintenance_damage_pins } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export type DamageView = 'top' | 'front' | 'back' | 'left' | 'right'
export type DamageCategory = '凹み' | '擦り傷' | '塗装剥がれ' | '破損' | 'サビ' | 'その他'
export type DamageSeverity = '軽' | '中' | '大'

export const DAMAGE_VIEWS: { value: DamageView; label: string }[] = [
  { value: 'top',   label: '俯瞰図' },
  { value: 'front', label: '前面' },
  { value: 'back',  label: '後面' },
  { value: 'left',  label: '左側面' },
  { value: 'right', label: '右側面' },
]

export const DAMAGE_CATEGORIES: DamageCategory[] = ['凹み', '擦り傷', '塗装剥がれ', '破損', 'サビ', 'その他']
export const DAMAGE_SEVERITIES: DamageSeverity[] = ['軽', '中', '大']

async function nextSortOrder(maintenanceId: string, view: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`COALESCE(MAX(${maintenance_damage_pins.sort_order}), -1)` })
    .from(maintenance_damage_pins)
    .where(eq(maintenance_damage_pins.maintenance_id, maintenanceId))
  return Number(rows[0]?.max ?? -1) + 1
  void view  // sort_order は maintenance 内で連番
}

export async function createDamagePin(
  maintenanceId: string,
  data: { view: DamageView; x_pct: number; y_pct: number; category: DamageCategory; severity: DamageSeverity; note?: string | null },
) {
  await requireEditor()
  const order = await nextSortOrder(maintenanceId, data.view)
  await db.insert(maintenance_damage_pins).values({
    maintenance_id: maintenanceId,
    view:           data.view,
    x_pct:          String(data.x_pct),
    y_pct:          String(data.y_pct),
    category:       data.category,
    severity:       data.severity,
    note:           data.note ?? null,
    sort_order:     order,
  })
  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function updateDamagePin(
  maintenanceId: string, pinId: string,
  data: { category: DamageCategory; severity: DamageSeverity; note?: string | null },
) {
  await requireEditor()
  await db.update(maintenance_damage_pins).set({
    category: data.category,
    severity: data.severity,
    note:     data.note ?? null,
  }).where(eq(maintenance_damage_pins.id, pinId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function deleteDamagePin(maintenanceId: string, pinId: string) {
  await requireEditor()
  await db.delete(maintenance_damage_pins).where(eq(maintenance_damage_pins.id, pinId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}
