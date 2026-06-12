import { describe, it, expect } from 'vitest'
import { repairTextValue } from './textGuard'

describe('repairTextValue（AIの固有名詞改変ガード REQ-0064）', () => {
  it('発話に無い近似語を発話の表記に修復する（福崎→福岡）', () => {
    expect(repairTextValue('福崎', '福岡のだいたい6000万の物件を出して')).toBe('福岡')
  })
  it('発話に含まれる値はそのまま', () => {
    expect(repairTextValue('福岡', '福岡の物件')).toBe('福岡')
    expect(repairTextValue('東京', '東京都内の取引先')).toBe('東京')
  })
  it('似た語が無ければそのまま（壊さない）', () => {
    expect(repairTextValue('大阪', '福岡の物件')).toBe('大阪')
  })
  it('1文字値・空値は対象外', () => {
    expect(repairTextValue('高', 'なにか')).toBe('高')
    expect(repairTextValue('', 'なにか')).toBe('')
  })
})
