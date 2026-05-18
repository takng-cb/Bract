/**
 * 諸費用編集 UI のサーバラッパ。
 * ステージング型: セル直接編集 → 「保存」で一括コミット。
 */
import { db } from '@/lib/db'
import { maintenance_fees } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createFee, updateFee, deleteFee } from '@/industries/auto-body/actions/maintenanceFees'
import StagedFeesTable from './StagedFeesTable'

type Props = {
  maintenanceId: string
  canEdit:       boolean
}

export default async function MaintenanceFeesEditor({ maintenanceId, canEdit }: Props) {
  const fees = await db.select().from(maintenance_fees)
    .where(eq(maintenance_fees.maintenance_id, maintenanceId))
    .orderBy(asc(maintenance_fees.sort_order))

  async function createAction(formData: FormData) {
    'use server'
    await createFee(maintenanceId, formData)
  }
  async function updateAction(feeId: string, formData: FormData) {
    'use server'
    await updateFee(maintenanceId, feeId, formData)
  }
  async function deleteAction(feeId: string) {
    'use server'
    await deleteFee(maintenanceId, feeId)
  }

  return (
    <StagedFeesTable
      initialFees={fees}
      canEdit={canEdit}
      createAction={createAction}
      updateAction={updateAction}
      deleteAction={deleteAction}
    />
  )
}
