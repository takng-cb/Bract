import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calcAutoBodyProfit,
  vehicleStatusColor,
  daysUntilInspection,
  SERVICE_TYPES,
  VEHICLE_STATUSES,
} from './autoBodyService'

describe('calcAutoBodyProfit（利益 = 売上 − 部品仕入原価）', () => {
  it('売上 50 万円・原価 20 万円 → 利益 30 万円', () => {
    expect(calcAutoBodyProfit(500_000, 200_000)).toBe(300_000)
  })

  it('売上 100 万円・原価 0 円 → 利益 100 万円', () => {
    expect(calcAutoBodyProfit(1_000_000, 0)).toBe(1_000_000)
  })

  it('赤字（原価が売上を上回る）→ 負の利益', () => {
    expect(calcAutoBodyProfit(100_000, 150_000)).toBe(-50_000)
  })

  it('売上 null → 0 − 原価 = 負の利益', () => {
    expect(calcAutoBodyProfit(null, 50_000)).toBe(-50_000)
  })

  it('全部 null → 0', () => {
    expect(calcAutoBodyProfit(null, null)).toBe(0)
    expect(calcAutoBodyProfit(undefined, undefined)).toBe(0)
  })
})

describe('vehicleStatusColor（状態に応じた semantic tone バッジ色 / ADR-0021）', () => {
  it('既知の状態は対応 tone を返す', () => {
    expect(vehicleStatusColor('在庫')).toContain('info')
    expect(vehicleStatusColor('代車中')).toContain('info')
    expect(vehicleStatusColor('販売済')).toContain('positive')
    expect(vehicleStatusColor('修理中')).toContain('warning')
    expect(vehicleStatusColor('メンテ中')).toContain('warning')
    expect(vehicleStatusColor('車検中')).toContain('ai')
    expect(vehicleStatusColor('納車待ち')).toContain('brand')
    expect(vehicleStatusColor('廃車')).toContain('n-')
  })

  it('VEHICLE_STATUSES の全状態で bg/text クラスが返る', () => {
    for (const s of VEHICLE_STATUSES) {
      expect(vehicleStatusColor(s)).toMatch(/bg-\S+\s+text-\S+/)
    }
  })

  it('未知の状態・null → デフォルト色', () => {
    expect(vehicleStatusColor('unknown')).toBe('bg-n-100 text-n-600')
    expect(vehicleStatusColor(null)).toBe('bg-n-100 text-n-600')
    expect(vehicleStatusColor(undefined)).toBe('bg-n-100 text-n-600')
  })
})

describe('daysUntilInspection（次回車検まで何日か）', () => {
  // 固定日時で日数計算を予測可能にする
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-05-12 00:00:00 UTC
    vi.setSystemTime(new Date('2026-05-12T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('30 日後の日付 → 30', () => {
    expect(daysUntilInspection('2026-06-11')).toBe(30)
  })

  it('当日 → 0（ms 差が負になる前にちょうど 0 のケースは厳密にはタイムゾーン依存）', () => {
    // 2026-05-12 を渡すと UTC 00:00 として解釈され、システム時刻と同じなので 0 となる
    expect(daysUntilInspection('2026-05-12')).toBe(0)
  })

  it('過去日 → 負の数', () => {
    expect(daysUntilInspection('2026-04-12')).toBe(-30)
  })

  it('Date オブジェクトも受け付ける', () => {
    const future = new Date('2026-05-22T00:00:00Z')
    expect(daysUntilInspection(future)).toBe(10)
  })

  it('null / undefined / 空文字 → null', () => {
    expect(daysUntilInspection(null)).toBeNull()
    expect(daysUntilInspection(undefined)).toBeNull()
    expect(daysUntilInspection('')).toBeNull()
  })

  it('不正な日付文字列 → null', () => {
    expect(daysUntilInspection('not-a-date')).toBeNull()
  })
})

describe('SERVICE_TYPES（サービス区分の固定リスト）', () => {
  it('5 種が定義されている', () => {
    expect(SERVICE_TYPES).toEqual(['車両販売', '板金修理', '整備', '車検', 'その他'])
  })
})
