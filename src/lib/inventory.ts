/**
 * inventory モジュール（Issue #48）の在庫計算ヘルパー。
 *
 * 在庫数は stock_movements の集計で動的に算出する（DB に冗長カラムを持たない）。
 *   - movement_type='入庫' → +quantity
 *   - movement_type='出庫' → -quantity
 *   - movement_type='調整' → +quantity（PoC では quantity をそのまま加算）
 *
 * lot/serial は #71 へ先送り。
 */
export const MOVEMENT_TYPES = ['入庫', '出庫', '調整'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export type StockMovementLike = {
  movement_type: string
  quantity: number | null
  warehouse_id?: string | null
}

export type StockBalance = {
  /** 全倉庫合計の在庫数 */
  total: number
  /** 倉庫IDごとの在庫数（warehouse_id が null の移動は '' キーに集約） */
  byWarehouse: Map<string, number>
}

/** movement_type に応じた符号付きデルタを返す */
export function movementDelta(movement: StockMovementLike): number {
  const q = Number(movement.quantity ?? 0)
  if (!Number.isFinite(q)) return 0
  switch (movement.movement_type) {
    case '入庫':
    case '調整':
      return q
    case '出庫':
      return -q
    default:
      return 0
  }
}

/** stock_movements の行配列から在庫数（合計・倉庫別）を計算 */
export function computeStockBalance(movements: StockMovementLike[]): StockBalance {
  let total = 0
  const byWarehouse = new Map<string, number>()
  for (const m of movements) {
    const delta = movementDelta(m)
    total += delta
    const key = m.warehouse_id ?? ''
    byWarehouse.set(key, (byWarehouse.get(key) ?? 0) + delta)
  }
  return { total, byWarehouse }
}

/**
 * 在庫が発注点を下回っているか判定する純粋関数。
 * reorderLevel が 0 以下（未設定）のときは常に false（アラート無効）。
 */
export function isBelowReorder(totalBalance: number, reorderLevel: number): boolean {
  return reorderLevel > 0 && totalBalance <= reorderLevel
}

/** 在庫数の表示用バッジ色（reorder_level との比較） */
export function stockBadgeColor(stock: number, reorderLevel: number): string {
  if (stock <= 0) return 'bg-danger-bg text-danger'
  if (stock <= reorderLevel) return 'bg-warning-bg text-warning'
  return 'bg-positive-bg text-positive'
}
