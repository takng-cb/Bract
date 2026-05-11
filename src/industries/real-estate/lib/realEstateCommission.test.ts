import { describe, it, expect } from 'vitest'
import {
  defaultCommissionFee,
  commissionBreakdown,
  effectiveCommissionRatePct,
  effectiveCommissionMonths,
  calcProfit,
  brokerageTypesFor,
  TEIREN_THRESHOLD,
  TEIREN_FEE,
  BROKERAGE_TYPES_SALE,
  BROKERAGE_TYPES_RENT,
} from './realEstateCommission'

describe('defaultCommissionFee（仲介手数料の既定値）', () => {
  describe('売買', () => {
    it('低廉特例（800万円以下）→ 30万円固定', () => {
      expect(defaultCommissionFee(8_000_000, '売買')).toBe(TEIREN_FEE)
      expect(defaultCommissionFee(5_000_000, '売買')).toBe(TEIREN_FEE)
      expect(defaultCommissionFee(1_000_000, '売買')).toBe(TEIREN_FEE)
    })

    it('800万円超 → 売買代金 × 3% + 6 万円', () => {
      // 5,000 万円: 5000万 * 3% + 6万 = 150万 + 6万 = 156万円
      expect(defaultCommissionFee(50_000_000, '売買')).toBe(1_560_000)
      // 1 億円: 1億 * 3% + 6万 = 300万 + 6万 = 306万円
      expect(defaultCommissionFee(100_000_000, '売買')).toBe(3_060_000)
    })

    it('境界値（ちょうど 800 万円）→ 30万円', () => {
      expect(defaultCommissionFee(TEIREN_THRESHOLD, '売買')).toBe(TEIREN_FEE)
    })

    it('境界値（800 万円 + 1 円）→ 速算式', () => {
      // 800万円 + 1: round(8000001 * 0.03 + 60000) = round(240000.03 + 60000) = 300000
      // 結果として TEIREN_FEE と同じだが計算式が違うことを確認
      const fee = defaultCommissionFee(TEIREN_THRESHOLD + 1, '売買')
      expect(fee).toBe(300_000)
    })

    it('低額物件で手数料が代金を超える場合 → null（手動入力に委ねる）', () => {
      // 100 円の物件に 30 万円固定は超過する
      expect(defaultCommissionFee(100, '売買')).toBeNull()
    })

    it('0 / 負の値 / undefined → null', () => {
      expect(defaultCommissionFee(0, '売買')).toBeNull()
      expect(defaultCommissionFee(-1, '売買')).toBeNull()
      expect(defaultCommissionFee(null, '売買')).toBeNull()
      expect(defaultCommissionFee(undefined, '売買')).toBeNull()
    })
  })

  describe('賃貸', () => {
    it('賃料 1 ヶ月分（標準）', () => {
      expect(defaultCommissionFee(150_000, '賃貸')).toBe(150_000)
      expect(defaultCommissionFee(80_000, '賃貸')).toBe(80_000)
    })

    it('0 以下 → null', () => {
      expect(defaultCommissionFee(0, '賃貸')).toBeNull()
      expect(defaultCommissionFee(-1000, '賃貸')).toBeNull()
    })
  })

  it('txType が未指定または "売買" 以外でも、デフォルトは売買扱い', () => {
    expect(defaultCommissionFee(10_000_000)).toBe(defaultCommissionFee(10_000_000, '売買'))
    expect(defaultCommissionFee(10_000_000, null)).toBe(defaultCommissionFee(10_000_000, '売買'))
  })
})

describe('commissionBreakdown（算出根拠の説明文）', () => {
  it('売買・低廉特例', () => {
    expect(commissionBreakdown(5_000_000, '売買')).toBe('低廉特例（30万円）')
    expect(commissionBreakdown(TEIREN_THRESHOLD, '売買')).toBe('低廉特例（30万円）')
  })

  it('売買・速算式', () => {
    expect(commissionBreakdown(10_000_000, '売買')).toBe('売買代金 × 3% + 6万円')
    expect(commissionBreakdown(100_000_000, '売買')).toBe('売買代金 × 3% + 6万円')
  })

  it('賃貸', () => {
    expect(commissionBreakdown(100_000, '賃貸')).toBe('賃料1ヶ月分（標準上限）')
  })

  it('0 以下 → 空文字', () => {
    expect(commissionBreakdown(0, '売買')).toBe('')
    expect(commissionBreakdown(null, '売買')).toBe('')
    expect(commissionBreakdown(undefined, '売買')).toBe('')
  })
})

describe('effectiveCommissionRatePct（売買: 手数料が代金の何%か）', () => {
  it('5000 万円・156 万円 → 3.12%', () => {
    const pct = effectiveCommissionRatePct(50_000_000, 1_560_000)
    expect(pct).toBeCloseTo(3.12, 2)
  })

  it('1 億円・306 万円 → 3.06%', () => {
    const pct = effectiveCommissionRatePct(100_000_000, 3_060_000)
    expect(pct).toBeCloseTo(3.06, 2)
  })

  it('0 以下や null → null', () => {
    expect(effectiveCommissionRatePct(0, 100_000)).toBeNull()
    expect(effectiveCommissionRatePct(100_000_000, 0)).toBeNull()
    expect(effectiveCommissionRatePct(null, null)).toBeNull()
  })
})

describe('effectiveCommissionMonths（賃貸: 手数料が賃料の何ヶ月分か）', () => {
  it('賃料 10 万円・手数料 10 万円 → 1.00 ヶ月', () => {
    expect(effectiveCommissionMonths(100_000, 100_000)).toBeCloseTo(1, 5)
  })

  it('賃料 10 万円・手数料 5 万円 → 0.50 ヶ月', () => {
    expect(effectiveCommissionMonths(100_000, 50_000)).toBeCloseTo(0.5, 5)
  })

  it('賃料 8 万円・手数料 16 万円 → 2.00 ヶ月（特例）', () => {
    expect(effectiveCommissionMonths(80_000, 160_000)).toBeCloseTo(2, 5)
  })

  it('0 以下や null → null', () => {
    expect(effectiveCommissionMonths(0, 100_000)).toBeNull()
    expect(effectiveCommissionMonths(100_000, 0)).toBeNull()
    expect(effectiveCommissionMonths(null, null)).toBeNull()
  })
})

describe('calcProfit（利益 = 手数料 × 両手なら2 + その他利益）', () => {
  it('片手（売り）: 手数料 100 万円・その他 0 → 100 万円', () => {
    expect(calcProfit(1_000_000, '売り', 0)).toBe(1_000_000)
  })

  it('片手（買い）: 手数料 100 万円・その他 0 → 100 万円', () => {
    expect(calcProfit(1_000_000, '買い', 0)).toBe(1_000_000)
  })

  it('両手: 手数料 100 万円・その他 0 → 200 万円', () => {
    expect(calcProfit(1_000_000, '両手', 0)).toBe(2_000_000)
  })

  it('両手 + その他利益 50 万円', () => {
    expect(calcProfit(1_000_000, '両手', 500_000)).toBe(2_500_000)
  })

  it('手数料 null → 0 ベース', () => {
    expect(calcProfit(null, '両手', 100_000)).toBe(100_000)
  })

  it('全部 null → 0', () => {
    expect(calcProfit(null, null, null)).toBe(0)
  })

  it('賃貸の仲介種別（貸主・借主）は片手扱い', () => {
    expect(calcProfit(100_000, '貸主', 0)).toBe(100_000)
    expect(calcProfit(100_000, '借主', 0)).toBe(100_000)
  })
})

describe('brokerageTypesFor（取引区分に応じた仲介種別選択肢）', () => {
  it('売買 → 両手 / 売り / 買い', () => {
    expect(brokerageTypesFor('売買')).toEqual(BROKERAGE_TYPES_SALE)
  })

  it('賃貸 → 両手 / 貸主 / 借主', () => {
    expect(brokerageTypesFor('賃貸')).toEqual(BROKERAGE_TYPES_RENT)
  })

  it('未指定や不明な値 → 売買扱い', () => {
    expect(brokerageTypesFor(null)).toEqual(BROKERAGE_TYPES_SALE)
    expect(brokerageTypesFor(undefined)).toEqual(BROKERAGE_TYPES_SALE)
    expect(brokerageTypesFor('その他')).toEqual(BROKERAGE_TYPES_SALE)
  })
})
