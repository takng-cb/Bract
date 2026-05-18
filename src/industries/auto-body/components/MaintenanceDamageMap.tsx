/**
 * 整備詳細ページの「損傷マップ」サブタブで使うサーバーラッパ。
 * ピン一覧を取得し、Client な DamageMapEditor に渡す。
 */
import { db } from '@/lib/db'
import { maintenance_damage_pins } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createDamagePin, updateDamagePin, deleteDamagePin } from '@/industries/auto-body/actions/maintenanceDamagePins'
import DamageMapEditor from './DamageMapEditor'
import type { DamageView, DamageCategory, DamageSeverity } from '@/industries/auto-body/lib/damageTypes'

type Props = {
  maintenanceId: string
  canEdit:       boolean
  /** 車両の body_shape を渡すと SVG シルエットが切り替わる */
  bodyShape?:    string | null
}

export default async function MaintenanceDamageMap({ maintenanceId, canEdit, bodyShape }: Props) {
  const pins = await db.select().from(maintenance_damage_pins)
    .where(eq(maintenance_damage_pins.maintenance_id, maintenanceId))
    .orderBy(asc(maintenance_damage_pins.view), asc(maintenance_damage_pins.sort_order))

  async function createAction(data: { view: string; x_pct: number; y_pct: number; category: string; severity: string; note: string | null }) {
    'use server'
    await createDamagePin(maintenanceId, {
      view:     data.view as DamageView,
      x_pct:    data.x_pct,
      y_pct:    data.y_pct,
      category: data.category as DamageCategory,
      severity: data.severity as DamageSeverity,
      note:     data.note,
    })
  }
  async function updateAction(pinId: string, data: { category: string; severity: string; note: string | null }) {
    'use server'
    await updateDamagePin(maintenanceId, pinId, {
      category: data.category as DamageCategory,
      severity: data.severity as DamageSeverity,
      note:     data.note,
    })
  }
  async function deleteAction(pinId: string) {
    'use server'
    await deleteDamagePin(maintenanceId, pinId)
  }

  return (
    <div className="space-y-3">
      <div className="bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2 text-xs text-zinc-700">
        🔧 <strong>損傷マップ</strong> — 車両図面に損傷箇所をピンで記録します（板金特化機能）。
        編集モードでは図面をクリックして追加、ピンをクリックで編集・削除できます。
      </div>
      <DamageMapEditor
        pins={pins}
        canEdit={canEdit}
        bodyShape={bodyShape}
        createAction={createAction}
        updateAction={updateAction}
        deleteAction={deleteAction}
      />
    </div>
  )
}
