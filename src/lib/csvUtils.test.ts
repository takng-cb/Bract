import { describe, it, expect } from 'vitest'
import { buildCsv, toCsvRow, parseCsvWithHeaders } from './csvUtils'

describe('CSV インジェクション対策', () => {
  it('=数式 で始まるセルはタブ付与で無害化', () => {
    expect(toCsvRow(['=1+2'])).toBe('"\t=1+2"')
  })
  it('+ - @ で始まる非数値も無害化', () => {
    expect(toCsvRow(['@cmd'])).toContain('"\t@cmd"')
    expect(toCsvRow(['+81-90'])).toBe('"\t+81-90"')   // 電話等
    expect(toCsvRow(['-abc'])).toBe('"\t-abc"')
  })
  it('純粋な負数はそのまま（数式扱いしない）', () => {
    expect(toCsvRow([-5])).toBe('"-5"')
    expect(toCsvRow(['-5.5'])).toBe('"-5.5"')
  })
  it('通常文字列・空はそのまま', () => {
    expect(toCsvRow(['株式会社サンプル'])).toBe('"株式会社サンプル"')
    expect(toCsvRow([''])).toBe('""')
  })
  it('ラウンドトリップ：export(無害化)→import(trim) で元値に戻る', () => {
    const csv = buildCsv(['式'], [['=SUM(A1:A2)']])
    const parsed = parseCsvWithHeaders(csv)
    expect(parsed[0]['式']).toBe('=SUM(A1:A2)') // タブは trim で除去
  })
})
