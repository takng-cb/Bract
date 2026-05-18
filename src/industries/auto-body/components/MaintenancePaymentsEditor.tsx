/**
 * 入金編集 UI のサーバラッパ。
 * ステージング型: セル直接編集 → 「保存」で一括コミット。
 */
import { db } from '@/lib/db'
import { maintenance_payments } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createPayment, updatePayment, deletePayment } from '@/industries/auto-body/actions/maintenancePayments'
import StagedPaymentsTable from './StagedPaymentsTable'

type Props = {
  maintenanceId: string
  canEdit:       boolean
  users:         { id: string; name: string }[]
  invoiceTotal?: number
}

export default async function MaintenancePaymentsEditor({ maintenanceId, canEdit, users, invoiceTotal }: Props) {
  const payments = await db.select().from(maintenance_payments)
    .where(eq(maintenance_payments.maintenance_id, maintenanceId))
    .orderBy(asc(maintenance_payments.payment_date))

  async function createAction(formData: FormData) {
    'use server'
    await createPayment(maintenanceId, formData)
  }
  async function updateAction(paymentId: string, formData: FormData) {
    'use server'
    await updatePayment(maintenanceId, paymentId, formData)
  }
  async function deleteAction(paymentId: string) {
    'use server'
    await deletePayment(maintenanceId, paymentId)
  }

  return (
    <StagedPaymentsTable
      initialPayments={payments}
      canEdit={canEdit}
      users={users}
      invoiceTotal={invoiceTotal}
      createAction={createAction}
      updateAction={updateAction}
      deleteAction={deleteAction}
    />
  )
}
