/**
 * 諸費用の表形式編集 UI（インライン）。
 */
import { db } from '@/lib/db'
import { maintenance_fees } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createFee, updateFee, deleteFee } from '@/industries/auto-body/actions/maintenanceFees'
import FeeRow from './FeeRow'
import FeeAddRow from './FeeAddRow'

type Props = {
  maintenanceId: string
  canEdit:       boolean
}

export default async function MaintenanceFeesEditor({ maintenanceId, canEdit }: Props) {
  const fees = await db.select().from(maintenance_fees)
    .where(eq(maintenance_fees.maintenance_id, maintenanceId))
    .orderBy(asc(maintenance_fees.sort_order))

  let taxable    = 0, nonTaxable = 0, costSum = 0
  for (const f of fees) {
    const a = Number(f.amount ?? 0)
    const c = Number(f.cost_amount ?? 0)
    if (Number.isFinite(a)) {
      if (f.category === '非課税') nonTaxable += a
      else                          taxable    += a
    }
    if (Number.isFinite(c)) costSum += c
  }
  const total = taxable + nonTaxable

  async function createAction(formData: FormData) {
    'use server'
    await createFee(maintenanceId, formData)
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <p className="text-xs text-zinc-500">
          セルをクリックで編集 → フォーカスを外すかセレクト変更で保存。
        </p>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
        <div className="min-w-[600px]">
          {/* ヘッダ */}
          <div className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_6rem_6rem_5rem] gap-1 px-2 py-1.5 bg-amber-50 border-b-2 border-amber-200 text-[11px] font-semibold text-amber-900">
            <div className="text-center">#</div>
            <div>区分</div>
            <div>項目名</div>
            <div className="text-right">金額</div>
            <div className="text-right">原価</div>
            <div className="text-right">操作</div>
          </div>

          {fees.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100">
              諸費用はまだありません。下の行から追加してください。
            </div>
          ) : (
            fees.map((f, idx) => (
              <FeeRow
                key={f.id}
                index={idx}
                fee={f}
                canEdit={canEdit}
                updateAction={updateFee.bind(null, maintenanceId, f.id)}
                deleteAction={deleteFee.bind(null, maintenanceId, f.id)}
              />
            ))
          )}

          {canEdit && <FeeAddRow action={createAction} />}

          {fees.length > 0 && (
            <div className="grid grid-cols-[2rem_5rem_minmax(0,1fr)_6rem_6rem_5rem] gap-1 px-2 py-2 bg-zinc-50 border-t-2 border-zinc-300 text-sm">
              <div></div>
              <div></div>
              <div className="text-right text-xs text-zinc-600">
                <span className="mr-3">課税計 <span className="font-mono">¥{taxable.toLocaleString()}</span></span>
                <span className="mr-3">非課税計 <span className="font-mono">¥{nonTaxable.toLocaleString()}</span></span>
              </div>
              <div className="text-right font-mono font-bold text-zinc-900">¥{total.toLocaleString()}</div>
              <div className="text-right text-xs text-zinc-500 font-mono">¥{costSum.toLocaleString()}</div>
              <div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
