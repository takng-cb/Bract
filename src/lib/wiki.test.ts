import { describe, it, expect } from 'vitest'
import { resolveWikiLinks } from './wiki'

describe('resolveWikiLinks', () => {
  it('既存タイトルは /wiki/<id> リンクに変換する', () => {
    const map = new Map([['設計方針', 'abc-123']])
    expect(resolveWikiLinks('詳細は [[設計方針]] を参照', map))
      .toBe('詳細は [設計方針](/wiki/abc-123) を参照')
  })

  it('未存在タイトルは /wiki/new?title= リンクに変換する', () => {
    const map = new Map<string, string>()
    expect(resolveWikiLinks('未作成の [[新規ページ]] です', map))
      .toBe('未作成の [新規ページ](/wiki/new?title=%E6%96%B0%E8%A6%8F%E3%83%9A%E3%83%BC%E3%82%B8) です')
  })

  it('リンク記法を含まないテキストは変更しない', () => {
    const map = new Map([['設計方針', 'abc-123']])
    expect(resolveWikiLinks('これは普通の文章です', map))
      .toBe('これは普通の文章です')
  })

  it('前後の空白をトリムして照合する', () => {
    const map = new Map([['設計方針', 'abc-123']])
    expect(resolveWikiLinks('[[ 設計方針 ]]', map))
      .toBe('[設計方針](/wiki/abc-123)')
  })

  it('複数のリンクをそれぞれ解決する', () => {
    const map = new Map([['A', 'id-a']])
    expect(resolveWikiLinks('[[A]] と [[B]]', map))
      .toBe('[A](/wiki/id-a) と [B](/wiki/new?title=B)')
  })
})
