import { describe, it, expect } from 'vitest'
import { extractHeadings, headingSlug } from './markdownToc'

describe('extractHeadings（Wiki 目次の自動生成 #129）', () => {
  it('h1〜h4 を階層付きで抽出する', () => {
    const md = '# 概要\n本文\n## 手順\n### 詳細手順\n#### 補足\n##### h5は対象外'
    const toc = extractHeadings(md)
    expect(toc.map((h) => [h.level, h.text])).toEqual([
      [1, '概要'], [2, '手順'], [3, '詳細手順'], [4, '補足'],
    ])
  })

  it('コードフェンス内の # は見出しとして拾わない', () => {
    const md = '# 本物\n```bash\n# コメント\n```\n## 本物2'
    expect(extractHeadings(md).map((h) => h.text)).toEqual(['本物', '本物2'])
  })

  it('インライン装飾（太字・コード・リンク）を落としたテキストになる', () => {
    const md = '## **重要** な `設定` と [リンク](https://example.com)'
    expect(extractHeadings(md)[0].text).toBe('重要 な 設定 と リンク')
  })

  it('slug は日本語を保持し空白をハイフンにする', () => {
    expect(headingSlug('リリース 手順')).toBe('リリース-手順')
    expect(headingSlug('Setup Guide')).toBe('setup-guide')
  })
})
