import { db } from '@/lib/db'
import { parts, part_movements } from '@/industries/auto-body/schema'
import { accounts } from '@/lib/schema'
import { asc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { calcStock, stockBadgeColor } from '@/industries/auto-body/lib/partsHelpers'

export default async function PartsListPage() {
  const [partRows, allMovements, edit] = await Promise.all([
    db.select({
      id:                  parts.id,
      part_number:         parts.part_number,
      name:                parts.name,
      category:            parts.category,
      unit_price:          parts.unit_price,
      reorder_level:       parts.reorder_level,
      supplier:            { id: accounts.id, name: accounts.name },
    })
      .from(parts)
      .leftJoin(accounts, eq(parts.supplier_account_id, accounts.id))
      .orderBy(asc(parts.part_number)),
    db.select({
      part_id: part_movements.part_id,
      movement_type: part_movements.movement_type,
      quantity: part_movements.quantity,
    }).from(part_movements),
    canEdit(),
  ])

  // part_id ごとに movements をグルーピング → 在庫数算出
  const movementsByPart = new Map<string, { movement_type: string; quantity: number | null }[]>()
  for (const m of allMovements) {
    const arr = movementsByPart.get(m.part_id) ?? []
    arr.push({ movement_type: m.movement_type, quantity: m.quantity })
    movementsByPart.set(m.part_id, arr)
  }

  const lowStockCount = partRows.filter((p) => {
    const stock = calcStock(movementsByPart.get(p.id) ?? [])
    return stock <= (p.reorder_level ?? 0)
  }).length

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">🔧 部品マスタ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            部品 {partRows.length} 件
            {lowStockCount > 0 && (
              <span className="ml-2 text-orange-600">・要発注 {lowStockCount} 件</span>
            )}
          </p>
        </div>
        {edit && (
          <Link href="/parts/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            ＋ 新規追加
          </Link>
        )}
      </div>

      {partRows.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg px-6 py-12 text-center text-sm text-zinc-400">
          部品がまだ登録されていません
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">品番</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">部品名</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">カテゴリ</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">単価</th>
                <th className="text-left  px-3 py-2 font-medium text-zinc-600">主仕入元</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">在庫</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-600">発注しきい値</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {partRows.map((p) => {
                const stock = calcStock(movementsByPart.get(p.id) ?? [])
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 font-mono text-zinc-700">
                      <Link href={`/parts/${p.id}`} className="hover:text-blue-600">{p.part_number}</Link>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/parts/${p.id}`} className="hover:text-blue-600">{p.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{p.category ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-zinc-700">
                      {p.unit_price ? `¥${Number(p.unit_price).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {p.supplier?.id
                        ? <Link href={`/accounts/${p.supplier.id}`} className="text-blue-600 hover:underline">{p.supplier.name}</Link>
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded font-semibold ${stockBadgeColor(stock, p.reorder_level ?? 0)}`}>
                        {stock} 個
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-zinc-400">
                      {p.reorder_level ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
