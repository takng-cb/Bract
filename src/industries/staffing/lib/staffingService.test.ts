/**
 * staffingService.ts の単体テスト (Issue #69)
 *
 * DB 接続を必要としないロジック (色判定、粗利計算) をテスト。
 */
import { describe, it, expect } from 'vitest'
import {
  staffStatusColor,
  assignmentStatusColor,
  calcAssignmentProfit,
  STAFF_STATUSES,
  ASSIGNMENT_STATUSES,
  ACCOUNT_ROLE_LABELS,
} from './staffingService'

describe('staffStatusColor（semantic tone / ADR-0021）', () => {
  it('全ステータスで bg/text クラスが返る', () => {
    for (const s of STAFF_STATUSES) {
      expect(staffStatusColor(s), `status: ${s}`).toMatch(/bg-\S+\s+text-\S+/)
    }
  })

  it('未知の値は neutral フォールバック', () => {
    expect(staffStatusColor('unknown')).toBe('bg-n-100 text-n-600')
    expect(staffStatusColor(null)).toBe('bg-n-100 text-n-600')
    expect(staffStatusColor(undefined)).toBe('bg-n-100 text-n-600')
  })
})

describe('assignmentStatusColor（semantic tone）', () => {
  it('全ステータスで bg/text クラスが返る', () => {
    for (const s of ASSIGNMENT_STATUSES) {
      expect(assignmentStatusColor(s), `status: ${s}`).toMatch(/bg-\S+\s+text-\S+/)
    }
  })
})

describe('calcAssignmentProfit', () => {
  it('client_total_fee が明示されていればそれを使う', () => {
    const r = calcAssignmentProfit(100_000, [
      { service_hours: 8, hourly_rate: 5000, cost_per_hour: 3000 },
      { service_hours: 8, hourly_rate: 5000, cost_per_hour: 3000 },
    ])
    expect(r.revenue).toBe(100_000)
    expect(r.cost).toBe(48_000)  // 8*3000 + 8*3000
    expect(r.profit).toBe(52_000)
  })

  it('client_total_fee が NULL/0 なら staff の hourly_rate × hours で fallback', () => {
    const r = calcAssignmentProfit(null, [
      { service_hours: 8, hourly_rate: 5000, cost_per_hour: 3000 },
      { service_hours: 4, hourly_rate: 6000, cost_per_hour: 3500 },
    ])
    expect(r.revenue).toBe(64_000)  // 8*5000 + 4*6000
    expect(r.cost).toBe(38_000)     // 8*3000 + 4*3500
    expect(r.profit).toBe(26_000)
  })

  it('staffEntries が空でも例外なし', () => {
    const r = calcAssignmentProfit(50_000, [])
    expect(r.revenue).toBe(50_000)
    expect(r.cost).toBe(0)
    expect(r.profit).toBe(50_000)
  })

  it('null/undefined フィールドはゼロ扱い', () => {
    const r = calcAssignmentProfit(null, [
      { service_hours: 8, hourly_rate: 5000, cost_per_hour: null },
      { service_hours: 8, hourly_rate: null,  cost_per_hour: 3000 },
    ])
    expect(r.cost).toBe(24_000)     // 8*0 + 8*3000
    expect(r.revenue).toBe(40_000)  // 8*5000 + 8*0
  })

  it('client_total_fee が文字列でも数値変換される', () => {
    const r = calcAssignmentProfit('80000', [
      { service_hours: 8, hourly_rate: 5000, cost_per_hour: 3000 },
    ])
    expect(r.revenue).toBe(80_000)
    expect(r.cost).toBe(24_000)
    expect(r.profit).toBe(56_000)
  })
})

describe('ACCOUNT_ROLE_LABELS', () => {
  it('全ての role に日本語ラベルが定義されている', () => {
    expect(ACCOUNT_ROLE_LABELS.supplier).toBe('人材会社')
    expect(ACCOUNT_ROLE_LABELS.client).toBe('派遣先')
    expect(ACCOUNT_ROLE_LABELS.both).toBe('両方')
  })
})
