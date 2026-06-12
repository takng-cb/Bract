import { describe, it, expect } from 'vitest'
import { diffLines, collapseUnchanged } from './textDiff'

describe('diffLines（Wiki 版差分 #129）', () => {
  it('追加・削除・共通行を判定する', () => {
    const d = diffLines('a\nb\nc', 'a\nx\nc')
    expect(d).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del',  text: 'b' },
      { type: 'add',  text: 'x' },
      { type: 'same', text: 'c' },
    ])
  })

  it('空文字 → 全行追加 / 逆は全行削除', () => {
    expect(diffLines('', 'a\nb')).toEqual([{ type: 'add', text: 'a' }, { type: 'add', text: 'b' }])
    expect(diffLines('a\nb', '')).toEqual([{ type: 'del', text: 'a' }, { type: 'del', text: 'b' }])
  })

  it('変更なしは全行 same', () => {
    expect(diffLines('a\nb', 'a\nb').every((l) => l.type === 'same')).toBe(true)
  })

  it('collapseUnchanged は変更の無い区間を省略する', () => {
    const lines = diffLines('1\n2\n3\n4\n5\n6\n7\n8\n9', '1\n2\n3\n4\nX\n6\n7\n8\n9')
    const hunks = collapseUnchanged(lines, 1)
    // 先頭の 1〜3 と末尾の 7〜9 が skip にまとまる
    expect(hunks[0]).toEqual({ type: 'skip', count: 3 })
    expect(hunks.at(-1)).toEqual({ type: 'skip', count: 3 })
    expect(hunks.some((h) => h.type === 'del' && h.text === '5')).toBe(true)
    expect(hunks.some((h) => h.type === 'add' && h.text === 'X')).toBe(true)
  })
})
