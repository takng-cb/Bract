import { describe, it, expect } from 'vitest'
import { calcWeightTax, inferWtType, inferAgeCategory } from './weightTax'

describe('calcWeightTax', () => {
  it('普通車 1500kg・13年未満・2年 = 3区分 × 4100 × 2 = 24600', () => {
    const r = calcWeightTax({ vehicleType: 'passenger', ageCategory: 'normal', years: 2, weightKg: 1500 })
    expect(r?.brackets).toBe(3)
    expect(r?.amount).toBe(24600)
  })
  it('普通車 1500kg・18年経過・2年 = 3 × 6300 × 2 = 37800', () => {
    expect(calcWeightTax({ vehicleType: 'passenger', ageCategory: 'over18', years: 2, weightKg: 1500 })?.amount).toBe(37800)
  })
  it('普通車 1010kg は 0.5t 切り上げで 3区分', () => {
    expect(calcWeightTax({ vehicleType: 'passenger', ageCategory: 'normal', years: 2, weightKg: 1010 })?.brackets).toBe(3)
  })
  it('普通車はエコカー本則 2500/0.5t', () => {
    expect(calcWeightTax({ vehicleType: 'passenger', ageCategory: 'eco', years: 2, weightKg: 1000 })?.amount).toBe(10000)
  })
  it('軽自動車は定額（重量無視）13年未満2年 = 3300 × 2 = 6600', () => {
    expect(calcWeightTax({ vehicleType: 'kei', ageCategory: 'normal', years: 2 })?.amount).toBe(6600)
  })
  it('軽自動車 18年経過 2年 = 4400 × 2 = 8800', () => {
    expect(calcWeightTax({ vehicleType: 'kei', ageCategory: 'over18', years: 2 })?.amount).toBe(8800)
  })
  it('普通車で重量未指定は null', () => {
    expect(calcWeightTax({ vehicleType: 'passenger', ageCategory: 'normal', years: 2 })).toBeNull()
  })
  it('不正な年数は null', () => {
    // @ts-expect-error 年数外
    expect(calcWeightTax({ vehicleType: 'kei', ageCategory: 'normal', years: 5 })).toBeNull()
  })
})

describe('inferWtType / inferAgeCategory', () => {
  it('「軽」を含めば kei', () => {
    expect(inferWtType('軽自動車')).toBe('kei')
    expect(inferWtType('普通乗用')).toBe('passenger')
    expect(inferWtType(null)).toBe('passenger')
  })
  it('経過年区分', () => {
    expect(inferAgeCategory(2024, 2026)).toBe('normal')
    expect(inferAgeCategory(2012, 2026)).toBe('over13')
    expect(inferAgeCategory(2006, 2026)).toBe('over18')
    expect(inferAgeCategory(null, 2026)).toBe('normal')
  })
})
