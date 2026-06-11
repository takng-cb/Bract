'use server'

import { db } from '@/lib/db'
import { maintenance_damage_pins } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { DamageView, DamageCategory, DamageSeverity } from '@/industries/auto-body/lib/damageTypes'
import { requirePermission } from '@/lib/permissions'

async function nextSortOrder(maintenanceId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`COALESCE(MAX(${maintenance_damage_pins.sort_order}), -1)` })
    .from(maintenance_damage_pins)
    .where(eq(maintenance_damage_pins.maintenance_id, maintenanceId))
  return Number(rows[0]?.max ?? -1) + 1
}

export async function createDamagePin(
  maintenanceId: string,
  data: { view: DamageView; x_pct: number; y_pct: number; category: DamageCategory; severity: DamageSeverity; note?: string | null },
) {
  await requirePermission('maintenance_records', 'create')
  const order = await nextSortOrder(maintenanceId)
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
  await requirePermission('maintenance_records', 'update')
  await db.update(maintenance_damage_pins).set({
    category: data.category,
    severity: data.severity,
    note:     data.note ?? null,
  }).where(eq(maintenance_damage_pins.id, pinId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function deleteDamagePin(maintenanceId: string, pinId: string) {
  await requirePermission('maintenance_records', 'delete')
  await db.delete(maintenance_damage_pins).where(eq(maintenance_damage_pins.id, pinId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}
