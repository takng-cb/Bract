import { db } from '@/lib/db'
import { maintenance_fees } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { createFee, updateFee, deleteFee } from '@/industries/auto-body/actions/maintenanceFees'
import FeeRow from './FeeRow'
import FeeAddForm from './FeeAddForm'

type Props = {
  maintenanceId: string
  canEdit:       boolean
}

export default async function MaintenanceFeesEditor({ maintenanceId, canEdit }: Props) {
  const fees = await db.select().from(maintenance_fees)
    .where(eq(maintenance_fees.maintenance_id, maintenanceId))
    .orderBy(asc(maintenance_fees.sort_order))

  let taxable    = 0
  let nonTaxable = 0
  let costSum    = 0
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
    <div className="space-y-4">
      {fees.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-400">諸費用はまだありません</p>
          {canEdit && <p className="text-xs text-zinc-400 mt-1">下のフォームから追加してください</p>}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {fees.map((f, idx) => (
            <FeeRow
              key={f.id}
              index={idx}
              fee={f}
              canEdit={canEdit}
              updateAction={updateFee.bind(null, maintenanceId, f.id)}
              deleteAction={deleteFee.bind(null, maintenanceId, f.id)}
            />
          ))}
        </div>
      )}

      {fees.length > 0 && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">課税計</dt>
              <dd className="font-mono text-zinc-800">¥{taxable.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">非課税計</dt>
              <dd className="font-mono text-zinc-800">¥{nonTaxable.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">諸費用合計</dt>
              <dd className="font-mono font-semibold text-zinc-900">¥{total.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">原価計</dt>
              <dd className="font-mono text-zinc-600">¥{costSum.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}

      {canEdit && <FeeAddForm action={createAction} />}
    </div>
  )
}
