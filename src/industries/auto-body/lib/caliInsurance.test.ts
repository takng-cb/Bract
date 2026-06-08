import { describe, it, expect } from 'vitest'
import { calcCaliPremium, inferCaliClass, CALI_TERMS } from './caliInsurance'

describe('calcCaliPremium（自賠責保険料・2023-04 本土）', () => {
  it('自家用乗用の標準期間で公定料率を返す', () => {
    expect(calcCaliPremium({ vehicleClass: 'passenger', months: 12 })?.premium).toBe(11500)
    expect(calcCaliPremium({ vehicleClass: 'passenger', months: 24 })?.premium).toBe(17650)
    expect(calcCaliPremium({ vehicleClass: 'passenger', months: 36 })?.premium).toBe(23690)
    expect(calcCaliPremium({ vehicleClass: 'passenger', months: 13 })?.premium).toBe(12010)
  })

  it('軽自動車の標準期間で公定料率を返す', () => {
    expect(calcCaliPremium({ vehicleClass: 'kei', months: 12 })?.premium).toBe(11440)
    expect(calcCaliPremium({ vehicleClass: 'kei', months: 24 })?.premium).toBe(17540)
    expect(calcCaliPremium({ vehicleClass: 'kei', months: 36 })?.premium).toBe(23520)
  })

  it('標準外の期間は null', () => {
    expect(calcCaliPremium({ vehicleClass: 'passenger', months: 6 })).toBeNull()
    expect(calcCaliPremium({ vehicleClass: 'passenger', months: 18 })).toBeNull()
  })

  it('結果に区分・期間・改定日が含まれる', () => {
    const r = calcCaliPremium({ vehicleClass: 'kei', months: 24 })
    expect(r).toMatchObject({ vehicleClass: 'kei', term: 24, region: 'mainland', revision: '2023-04-01' })
  })

  it('全標準期間で passenger/kei とも値が存在する', () => {
    for (const m of CALI_TERMS) {
      expect(calcCaliPremium({ vehicleClass: 'passenger', months: m })?.premium).toBeGreaterThan(0)
      expect(calcCaliPremium({ vehicleClass: 'kei', months: m })?.premium).toBeGreaterThan(0)
    }
  })
})

describe('inferCaliClass', () => {
  it('「軽」を含めば kei、それ以外は passenger', () => {
    expect(inferCaliClass('軽自動車')).toBe('kei')
    expect(inferCaliClass('軽四')).toBe('kei')
    expect(inferCaliClass('普通乗用')).toBe('passenger')
    expect(inferCaliClass('小型乗用')).toBe('passenger')
    expect(inferCaliClass(null)).toBe('passenger')
    expect(inferCaliClass(undefined)).toBe('passenger')
  })
})
