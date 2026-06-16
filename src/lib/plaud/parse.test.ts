import { describe, it, expect } from 'vitest'
import { extractPlaudToken, parsePlaud, PlaudError, type ShareResponse } from './parse'

const TOKEN = 'pub_99396f64-3941-4893-9c75-1d6413a56831::kDv855wV9hNFdKvoubC5FnPe'

describe('extractPlaudToken', () => {
  it('共有リンク /s/<token> からトークンを取り出す', () => {
    expect(extractPlaudToken(`https://web.plaud.ai/s/${TOKEN}`)).toBe(TOKEN)
  })
  it('/nshare/<token> も対応', () => {
    expect(extractPlaudToken(`https://web.plaud.ai/nshare/${TOKEN}`)).toBe(TOKEN)
  })
  it('生トークン直貼りも許容', () => {
    expect(extractPlaudToken(TOKEN)).toBe(TOKEN)
  })
  it('前後の空白を許容', () => {
    expect(extractPlaudToken(`  https://web.plaud.ai/s/${TOKEN}  `)).toBe(TOKEN)
  })
  it('plaud.ai 以外のホストは拒否（SSRF対策）', () => {
    expect(extractPlaudToken(`https://evil.example.com/s/${TOKEN}`)).toBeNull()
    expect(extractPlaudToken(`https://web.plaud.ai.evil.com/s/${TOKEN}`)).toBeNull()
  })
  it('http はリンクとして拒否', () => {
    expect(extractPlaudToken(`http://web.plaud.ai/s/${TOKEN}`)).toBeNull()
  })
  it('リンクでない/空は null', () => {
    expect(extractPlaudToken('ただのメモ')).toBeNull()
    expect(extractPlaudToken('')).toBeNull()
  })
})

describe('parsePlaud', () => {
  const base: ShareResponse = {
    data_file: {
      filename: '06-15 前島におけるウェルネスリトリート',
      file_language: 'ja',
      trans_result: [
        { speaker: 'A', content: 'これはテストです。' },
        { content: '話者なしの行。' },
        { content: '  ' }, // 空はスキップ
      ],
      notes_list: [{ data_content: '要約1' }, { data_content: '要約2' }],
    },
  }

  it('タイトル/文字起こし/要約を整形する', () => {
    const c = parsePlaud(base)
    expect(c.title).toBe('06-15 前島におけるウェルネスリトリート')
    expect(c.transcript).toBe('A: これはテストです。\n話者なしの行。')
    expect(c.summary).toBe('要約1\n\n要約2')
    expect(c.language).toBe('ja')
  })

  it('文字起こしも要約も空なら PlaudError(empty)', () => {
    expect(() => parsePlaud({ data_file: { filename: 'x', trans_result: [], notes_list: [] } }))
      .toThrowError(PlaudError)
  })

  it('data_file が無ければ PlaudError(empty)', () => {
    expect(() => parsePlaud({})).toThrowError(PlaudError)
  })
})
