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

describe('vehicleStatusColor（状態に応じた Tailwind バッジ色）', () => {
  it('既知の状態は対応色を返す', () => {
    expect(vehicleStatusColor('在庫')).toContain('blue')
    expect(vehicleStatusColor('販売済')).toContain('green')
    expect(vehicleStatusColor('修理中')).toContain('orange')
    expect(vehicleStatusColor('メンテ中')).toContain('yellow')
    expect(vehicleStatusColor('車検中')).toContain('purple')
    expect(vehicleStatusColor('納車待ち')).toContain('cyan')
    expect(vehicleStatusColor('廃車')).toContain('zinc')
  })

  it('VEHICLE_STATUSES に列挙された全状態でフォールバックでない色が返る', () => {
    for (const s of VEHICLE_STATUSES) {
      const color = vehicleStatusColor(s)
      // フォールバックは 'bg-zinc-50 text-zinc-700' なので、それと一致するのは「廃車」だけのはず…
      // と思いきや、廃車は 'bg-zinc-100' で異なる。よって VEHICLE_STATUSES のすべてはフォールバックとは異なる
      expect(color).not.toBe('bg-zinc-50  text-zinc-700')
    }
  })

  it('未知の状態・null → デフォルト色', () => {
    expect(vehicleStatusColor('unknown')).toBe('bg-zinc-50  text-zinc-700')
    expect(vehicleStatusColor(null)).toBe('bg-zinc-50  text-zinc-700')
    expect(vehicleStatusColor(undefined)).toBe('bg-zinc-50  text-zinc-700')
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
