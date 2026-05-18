/**
 * 入金の表形式編集 UI（インライン）。
 */
import { db } from '@/lib/db'
import { maintenance_payments } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createPayment, updatePayment, deletePayment } from '@/industries/auto-body/actions/maintenancePayments'
import PaymentRow from './PaymentRow'
import PaymentAddRow from './PaymentAddRow'

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
    <div className="space-y-2">
      {canEdit && (
        <p className="text-xs text-zinc-500">
          セルをクリックで編集 → フォーカスを外すかセレクト変更で保存。
        </p>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
        <div className="min-w-[800px]">
          {/* ヘッダ */}
          <div className="grid grid-cols-[2rem_7rem_6rem_7rem_minmax(0,1fr)_8rem_5rem] gap-1 px-2 py-1.5 bg-amber-50 border-b-2 border-amber-200 text-[11px] font-semibold text-amber-900">
            <div className="text-center">#</div>
            <div>入金日</div>
            <div>支払方法</div>
            <div className="text-right">金額</div>
            <div>メモ</div>
            <div>担当者</div>
            <div className="text-right">操作</div>
          </div>

          {payments.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100">
              入金記録はまだありません。下の行から追加してください。
            </div>
          ) : (
            payments.map((p, idx) => (
              <PaymentRow
                key={p.id}
                index={idx}
                payment={p}
                users={users}
                canEdit={canEdit}
                updateAction={updatePayment.bind(null, maintenanceId, p.id)}
                deleteAction={deletePayment.bind(null, maintenanceId, p.id)}
              />
            ))
          )}

          {canEdit && <PaymentAddRow action={createAction} users={users} />}

          {payments.length > 0 && (
            <div className="grid grid-cols-[2rem_7rem_6rem_7rem_minmax(0,1fr)_8rem_5rem] gap-1 px-2 py-2 bg-zinc-50 border-t-2 border-zinc-300 text-sm">
              <div></div>
              <div></div>
              <div className="text-right text-xs text-zinc-600">入金合計</div>
              <div className="text-right font-mono font-bold">¥{paidSum.toLocaleString()}</div>
              {invoiceTotal != null && (
                <>
                  <div className="text-right text-xs text-zinc-600">
                    請求合計 <span className="font-mono">¥{invoiceTotal.toLocaleString()}</span>
                  </div>
                  <div className={`text-right text-xs font-bold ${balance != null && balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    残額 <span className="font-mono">¥{(balance ?? 0).toLocaleString()}</span>
                  </div>
                </>
              )}
              <div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
