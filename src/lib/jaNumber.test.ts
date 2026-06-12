import { describe, it, expect } from 'vitest'
import { normalizeJaNumbers } from './jaNumber'

describe('normalizeJaNumbers（AI検索の数量単位正規化 REQ-0060）', () => {
  it('万・億・千を数値化する', () => {
    expect(normalizeJaNumbers('100万円以上の商談')).toBe('1000000円以上の商談')
    expect(normalizeJaNumbers('1.5万円')).toBe('15000円')
    expect(normalizeJaNumbers('3千円未満')).toBe('3000円未満')
    expect(normalizeJaNumbers('2億円')).toBe('200000000円')
    expect(normalizeJaNumbers('1億5000万円')).toBe('150000000円')
  })

  it('数字を伴わない単位語は変換しない', () => {
    expect(normalizeJaNumbers('数万円の経費')).toBe('数万円の経費')
    expect(normalizeJaNumbers('億万長者')).toBe('億万長者')
  })

  it('単位の無いテキストはそのまま', () => {
    expect(normalizeJaNumbers('交渉中の商談')).toBe('交渉中の商談')
  })
})
