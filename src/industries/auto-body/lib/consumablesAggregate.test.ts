/**
 * 消耗品集計のユニットテスト (Phase A item 4)
 */
import { describe, it, expect } from 'vitest'
import {
  aggregateLatestConsumables,
  CONSUMABLE_CATEGORIES,
  type LineWithMaintenance,
} from './consumablesAggregate'

function line(p: Partial<LineWithMaintenance>): LineWithMaintenance {
  return {
    maintenance_id: p.maintenance_id ?? 'm-1',
    work_category:  p.work_category  ?? null,
    item_name:      p.item_name      ?? null,
    intake_date:    p.intake_date    ?? null,
    delivery_date:  p.delivery_date  ?? null,
    mileage:        p.mileage        ?? null,
  }
}

describe('aggregateLatestConsumables', () => {
  it('空配列なら結果も空', () => {
    expect(aggregateLatestConsumables([])).toEqual([])
  })

  it('オイル交換のラインが 1 件のみあればそのカテゴリだけ返る', () => {
    const r = aggregateLatestConsumables([
      line({ item_name: 'エンジンオイル交換', delivery_date: '2026-03-10', mileage: 12000, maintenance_id: 'm-A' }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      categoryId:    'oil',
      date:          '2026-03-10',
      mileage:       12000,
      maintenanceId: 'm-A',
    })
  })

  it('同一カテゴリで複数件あれば最新日付の 1 件のみ返す', () => {
    const r = aggregateLatestConsumables([
      line({ item_name: 'オイル交換', delivery_date: '2025-01-10', mileage: 5000 }),
      line({ item_name: 'オイル交換', delivery_date: '2026-04-01', mileage: 18000, maintenance_id: 'm-LATEST' }),
      line({ item_name: 'オイル交換', delivery_date: '2025-09-20', mileage: 10000 }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].date).toBe('2026-04-01')
    expect(r[0].maintenanceId).toBe('m-LATEST')
  })

  it('delivery_date が無い場合は intake_date を使う', () => {
    const r = aggregateLatestConsumables([
      line({ item_name: 'バッテリー交換', intake_date: '2026-05-01' }),
    ])
    expect(r[0].date).toBe('2026-05-01')
  })

  it('複数カテゴリが混在しても、定義順 (oil, battery, tire, brake, wiper, inspection) で返る', () => {
    const r = aggregateLatestConsumables([
      line({ item_name: '車検整備', delivery_date: '2026-02-01' }),
      line({ item_name: 'バッテリー交換', delivery_date: '2026-02-01' }),
      line({ item_name: 'タイヤ交換', delivery_date: '2026-02-01' }),
      line({ item_name: 'エンジンオイル交換', delivery_date: '2026-02-01' }),
    ])
    expect(r.map((x) => x.categoryId)).toEqual(['oil', 'battery', 'tire', 'inspection'])
  })

  it('1 行は 1 カテゴリにだけ寄せる (オイル "and" バッテリーは入力できない想定)', () => {
    // "オイル交換" のキーワードが先にマッチするので oil 側のみ
    const r = aggregateLatestConsumables([
      line({ item_name: 'オイル交換とバッテリー点検', delivery_date: '2026-03-01' }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].categoryId).toBe('oil')
  })

  it('該当しない項目名は何も返さない', () => {
    const r = aggregateLatestConsumables([
      line({ item_name: '内装清掃' }),
      line({ work_category: 'その他', item_name: '芳香剤交換' }),
    ])
    expect(r).toEqual([])
  })

  it('mileage は number / string どちらでも受け入れて Number 化する', () => {
    const r = aggregateLatestConsumables([
      line({ item_name: 'オイル交換', delivery_date: '2026-01-01', mileage: '42000' }),
    ])
    expect(r[0].mileage).toBe(42000)
  })

  it('CONSUMABLE_CATEGORIES は重複なく定義されている', () => {
    const ids = CONSUMABLE_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
