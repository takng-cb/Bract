import { describe, it, expect } from 'vitest'
import { computeStockBalance, movementDelta } from './inventory'

describe('movementDelta', () => {
  it('入庫 is positive', () => {
    expect(movementDelta({ movement_type: '入庫', quantity: 5 })).toBe(5)
  })
  it('出庫 is negative', () => {
    expect(movementDelta({ movement_type: '出庫', quantity: 3 })).toBe(-3)
  })
  it('調整 is added as-is', () => {
    expect(movementDelta({ movement_type: '調整', quantity: 2 })).toBe(2)
  })
  it('null quantity and unknown type are 0', () => {
    expect(movementDelta({ movement_type: '入庫', quantity: null })).toBe(0)
    expect(movementDelta({ movement_type: 'なにか', quantity: 9 })).toBe(0)
  })
})

describe('computeStockBalance', () => {
  it('sums in/out/adjust across movements', () => {
    const { total } = computeStockBalance([
      { movement_type: '入庫', quantity: 10 },
      { movement_type: '出庫', quantity: 4 },
      { movement_type: '調整', quantity: 1 },
    ])
    expect(total).toBe(7) // 10 - 4 + 1
  })

  it('aggregates per warehouse', () => {
    const { total, byWarehouse } = computeStockBalance([
      { movement_type: '入庫', quantity: 10, warehouse_id: 'w1' },
      { movement_type: '出庫', quantity: 4, warehouse_id: 'w1' },
      { movement_type: '入庫', quantity: 5, warehouse_id: 'w2' },
    ])
    expect(total).toBe(11)
    expect(byWarehouse.get('w1')).toBe(6)
    expect(byWarehouse.get('w2')).toBe(5)
  })

  it('groups null warehouse under empty-string key', () => {
    const { byWarehouse } = computeStockBalance([
      { movement_type: '入庫', quantity: 3, warehouse_id: null },
    ])
    expect(byWarehouse.get('')).toBe(3)
  })

  it('returns zero total for empty input', () => {
    expect(computeStockBalance([]).total).toBe(0)
  })
})
