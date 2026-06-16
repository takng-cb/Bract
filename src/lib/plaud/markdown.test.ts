import { describe, it, expect } from 'vitest'
import { parsePlaudMarkdown, PlaudParseError } from './markdown'

const SAMPLE = `# 06-15 前島におけるウェルネスリトリート事業の構想
# 06-15 前島におけるウェルネスリトリート事業の構想

[Image]

本稿は、岡山県の前島を舞台とした事業構想の議論をまとめたもの。

------------
## 参加者紹介と事業背景
冒頭の参加者紹介と背景説明を扱う。中川公認会計士らが参加。

------------
## 集客戦略とアライアンスの検討
具体的な集客方法と潜在的な提携先について議論した。

------------
## アクションアイテム
### @宮田氏
- [ ] ファスティング時のメニューを考案する - [TBD]
- [ ] オリジナルの温泉入浴剤を作成し販売を計画する - [TBD]

### @永田氏
- [ ] 18:25に到着し18:30の船で出発できるよう参加者を案内する - [完了]
`

describe('parsePlaudMarkdown', () => {
  const r = parsePlaudMarkdown(SAMPLE)

  it('タイトルは最初の # 見出し（重複は1つだけ）', () => {
    expect(r.title).toBe('06-15 前島におけるウェルネスリトリート事業の構想')
  })

  it('セクション本文を summary に集約（[Image]・区切り線は除去）', () => {
    expect(r.summary).toContain('本稿は、岡山県の前島')
    expect(r.summary).toContain('## 参加者紹介と事業背景')
    expect(r.summary).toContain('## 集客戦略とアライアンスの検討')
    expect(r.summary).not.toContain('[Image]')
    expect(r.summary).not.toContain('------')
    // アクションアイテムは summary に含めない
    expect(r.summary).not.toContain('ファスティング時のメニュー')
  })

  it('アクションアイテムを担当者・タスク・ステータスで抽出', () => {
    expect(r.actionItems).toHaveLength(3)
    expect(r.actionItems[0]).toEqual({ person: '宮田氏', task: 'ファスティング時のメニューを考案する', status: 'TBD' })
    expect(r.actionItems[2]).toEqual({ person: '永田氏', task: '18:25に到着し18:30の船で出発できるよう参加者を案内する', status: '完了' })
  })

  it('body は summary ＋ アクションアイテム（完了は ✓、担当でグループ）', () => {
    expect(r.body).toContain('## 参加者紹介と事業背景')
    expect(r.body).toContain('## アクションアイテム')
    expect(r.body).toContain('### @宮田氏')
    expect(r.body).toContain('- ファスティング時のメニューを考案する（TBD）')
    expect(r.body).toContain('- ✓ 18:25に到着')
  })

  it('空入力は PlaudParseError', () => {
    expect(() => parsePlaudMarkdown('')).toThrowError(PlaudParseError)
    expect(() => parsePlaudMarkdown('   \n  ')).toThrowError(PlaudParseError)
  })

  it('見出しの無いプレーンテキストでも本文として読む', () => {
    const r2 = parsePlaudMarkdown('ただの議事メモ。\n次回は来週。')
    expect(r2.summary).toContain('ただの議事メモ')
    expect(r2.title).toBe('（無題）')
  })
})
