import { db } from '@/lib/db'
import { parts, part_movements, vehicles } from '@/industries/auto-body/schema'
import { accounts, opportunities } from '@/lib/schema'
import { eq, desc, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deletePart, createPartMovement, deletePartMovement } from '@/industries/auto-body/actions/parts'
import { calcStock, stockBadgeColor, MOVEMENT_TYPES } from '@/industries/auto-body/lib/partsHelpers'

export default async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [partRow, movementRows, opps, vehs] = await Promise.all([
    db.select({
      id: parts.id, part_number: parts.part_number, name: parts.name,
      category: parts.category, unit_price: parts.unit_price,
      reorder_level: parts.reorder_level, description: parts.description,
      created_at: parts.created_at,
      supplier: { id: accounts.id, name: accounts.name },
    })
      .from(parts)
      .leftJoin(accounts, eq(parts.supplier_account_id, accounts.id))
      .where(eq(parts.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:             part_movements.id,
      movement_type:  part_movements.movement_type,
      quantity:       part_movements.quantity,
      unit_price:     part_movements.unit_price,
      occurred_at:    part_movements.occurred_at,
      notes:          part_movements.notes,
      opportunity_id: part_movements.opportunity_id,
      vehicle_id:     part_movements.vehicle_id,
    })
      .from(part_movements)
      .where(eq(part_movements.part_id, id))
      .orderBy(desc(part_movements.occurred_at), desc(part_movements.created_at)),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities).orderBy(desc(opportunities.created_at)),
    db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate }).from(vehicles).orderBy(asc(vehicles.maker), asc(vehicles.model)),
  ])

  if (!partRow) notFound()

  const stock = calcStock(movementRows)

  async function handleDelete() {
    'use server'
    await deletePart(id)
  }

  async function addMovement(formData: FormData) {
    'use server'
    formData.set('part_id', id)
    await createPartMovement(formData)
  }

  async function removeMovement(formData: FormData) {
    'use server'
    const mid = formData.get('movement_id') as string
    if (mid) await deletePartMovement(mid, id)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[{ label: '部品マスタ', href: '/parts' }, { label: partRow.name }]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/parts/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この部品を削除しますか？関連する入出庫履歴もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900">🔧 {partRow.name}</h1>
        <p className="text-sm text-zinc-500 mt-1 font-mono">{partRow.part_number}</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">部品情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">カテゴリ</dt>
            <dd className="text-sm text-zinc-800">{partRow.category ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">標準仕入単価</dt>
            <dd className="text-sm text-zinc-800">{partRow.unit_price ? `¥${Number(partRow.unit_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">主仕入元</dt>
            <dd className="text-sm text-zinc-800">
              {partRow.supplier?.id
                ? <Link href={`/accounts/${partRow.supplier.id}`} className="text-blue-600 hover:underline">{partRow.supplier.name}</Link>
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">発注しきい値</dt>
            <dd className="text-sm text-zinc-800">{partRow.reorder_level} 個</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-200 flex justify-between items-baseline">
          <span className="text-sm font-semibold text-zinc-700">現在庫</span>
          <span className={`px-3 py-1 rounded text-base font-bold ${stockBadgeColor(stock, partRow.reorder_level ?? 0)}`}>
            {stock} 個
          </span>
        </div>
        {partRow.description && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <dt className="text-xs text-zinc-400 mb-1">備考</dt>
            <dd className="text-sm text-zinc-800 whitespace-pre-wrap">{partRow.description}</dd>
          </div>
        )}
      </div>

      {/* 入出庫追加フォーム */}
      <AuthGuard minRole="editor">
        <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">入出庫を記録</h2>
          <form action={addMovement} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select name="movement_type" required defaultValue="入庫"
              className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
              {MOVEMENT_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input name="quantity" type="number" min="1" placeholder="数量" required
              className="border border-zinc-300 rounded px-3 py-2 text-sm" />
            <input name="occurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)}
              className="border border-zinc-300 rounded px-3 py-2 text-sm" />
            <input name="unit_price" type="number" min="0" placeholder="単価（任意）"
              className="border border-zinc-300 rounded px-3 py-2 text-sm" />
            <select name="opportunity_id" className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
              <option value="">— 関連商談（任意）—</option>
              {opps.slice(0, 50).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select name="vehicle_id" className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
              <option value="">— 関連車両（任意）—</option>
              {vehs.map((v) => (
                <option key={v.id} value={v.id}>{v.maker} {v.model}{v.license_plate ? ` / ${v.license_plate}` : ''}</option>
              ))}
            </select>
            <input name="notes" placeholder="メモ（任意）" className="sm:col-span-2 border border-zinc-300 rounded px-3 py-2 text-sm" />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">記録</button>
          </form>
        </div>
      </AuthGuard>

      {/* 履歴 */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">入出庫履歴 <span className="text-zinc-400 font-normal text-sm">({movementRows.length})</span></h2>
        {movementRows.length === 0 ? (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">履歴がありません</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">日付</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">種別</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">数量</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">単価</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">メモ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {movementRows.map((m) => {
                  const sign = m.movement_type === '出庫' ? '−' : '＋'
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-700">{m.occurred_at}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          m.movement_type === '入庫' ? 'bg-blue-50 text-blue-700' :
                          m.movement_type === '出庫' ? 'bg-orange-50 text-orange-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>{m.movement_type}</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${m.movement_type === '出庫' ? 'text-orange-600' : 'text-zinc-700'}`}>
                        {sign} {m.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">
                        {m.unit_price ? `¥${Number(m.unit_price).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 truncate max-w-xs">{m.notes ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <AuthGuard minRole="editor">
                          <form action={removeMovement}>
                            <input type="hidden" name="movement_id" value={m.id} />
                            <button type="submit" className="text-xs text-red-400 hover:text-red-600">削除</button>
                          </form>
                        </AuthGuard>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
