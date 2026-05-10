/**
 * 部品マスタ・在庫管理用のヘルパー。
 *
 * 在庫数は part_movements の集計で動的に算出する（DB に冗長カラムを持たない）。
 *   - movement_type='入庫'    → +quantity
 *   - movement_type='出庫'    → -quantity
 *   - movement_type='棚卸調整' → +quantity（負の値も可、UI 側でハンドリング）
 */
export const MOVEMENT_TYPES = ['入庫', '出庫', '棚卸調整'] as const
export type MovementType = typeof MOVEMENT_TYPES[number]

/** part_movements の行配列から在庫数を計算 */
export function calcStock(
  movements: { movement_type: string; quantity: number | null }[],
): number {
  let stock = 0
  for (const m of movements) {
    const q = Number(m.quantity ?? 0)
    if (m.movement_type === '入庫' || m.movement_type === '棚卸調整') stock += q
    else if (m.movement_type === '出庫') stock -= q
  }
  return stock
}

/** 在庫数の表示用バッジ色（reorder_level との比較） */
export function stockBadgeColor(stock: number, reorderLevel: number): string {
  if (stock <= 0) return 'bg-red-50 text-red-700'
  if (stock <= reorderLevel) return 'bg-orange-50 text-orange-700'
  return 'bg-green-50 text-green-700'
}
