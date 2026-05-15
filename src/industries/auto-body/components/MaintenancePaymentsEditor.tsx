import { db } from '@/lib/db'
import { maintenance_payments } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createPayment, updatePayment, deletePayment } from '@/industries/auto-body/actions/maintenancePayments'
import PaymentRow from './PaymentRow'
import PaymentAddForm from './PaymentAddForm'

type Props = {
  maintenanceId: string
  canEdit:       boolean
  users:         { id: string; name: string }[]
  /** 売上額（行アイテム + 諸費用、税抜想定）。請求合計の参考表示用。 */
  invoiceTotal?: number
}

export default async function MaintenancePaymentsEditor({ maintenanceId, canEdit, users, invoiceTotal }: Props) {
  const payments = await db.select().from(maintenance_payments)
    .where(eq(maintenance_payments.maintenance_id, maintenanceId))
    .orderBy(asc(maintenance_payments.payment_date))

  let paidSum = 0
  for (const p of payments) {
    const a = Number(p.amount ?? 0)
    if (Number.isFinite(a)) paidSum += a
  }
  const balance = invoiceTotal != null ? invoiceTotal - paidSum : null

  async function createAction(formData: FormData) {
    'use server'
    await createPayment(maintenanceId, formData)
  }

  return (
    <div className="space-y-4">
      {payments.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-400">入金記録はまだありません</p>
          {canEdit && <p className="text-xs text-zinc-400 mt-1">下のフォームから追加してください</p>}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {payments.map((p, idx) => (
            <PaymentRow
              key={p.id}
              index={idx}
              payment={p}
              users={users}
              canEdit={canEdit}
              updateAction={updatePayment.bind(null, maintenanceId, p.id)}
              deleteAction={deletePayment.bind(null, maintenanceId, p.id)}
            />
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">入金合計</dt>
              <dd className="font-mono font-semibold text-zinc-900">¥{paidSum.toLocaleString()}</dd>
            </div>
            {invoiceTotal != null && (
              <>
                <div>
                  <dt className="text-xs text-zinc-500">請求合計（税抜参考）</dt>
                  <dd className="font-mono text-zinc-700">¥{invoiceTotal.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">残額</dt>
                  <dd className={`font-mono font-semibold ${balance != null && balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    ¥{(balance ?? 0).toLocaleString()}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      )}

      {canEdit && <PaymentAddForm action={createAction} users={users} />}
    </div>
  )
}
