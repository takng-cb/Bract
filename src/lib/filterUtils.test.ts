import { describe, it, expect } from 'vitest'

// filterUtils は db（neon クライアント）を import するため、接続文字列が無いと
// import 自体が落ちる。クエリは実行しないのでダミーを与えて読み込む。
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
const { parseFilterParams, applyFilters } = await import('./filterUtils')

describe('applyFilters（一覧/エクスポート共通の JS フィルタ）', () => {
  const rows = [
    { id: '1', title: 'A', occurred_at: new Date('2026-06-10T15:00:00Z') }, // JST 2026-06-11
    { id: '2', title: 'B', occurred_at: new Date('2026-06-12T01:00:00Z') }, // JST 2026-06-12
    { id: '3', title: 'C', occurred_at: null },
  ]

  it('timestamp（Date オブジェクト）の gte/lte/eq が JST 日付で正しく効く（#132）', () => {
    expect(applyFilters(rows, [{ field: 'occurred_at', op: 'gte', value: '2026-06-12' }]).map((r) => r.id)).toEqual(['2'])
    expect(applyFilters(rows, [{ field: 'occurred_at', op: 'lte', value: '2026-06-11' }]).map((r) => r.id)).toEqual(['1'])
    expect(applyFilters(rows, [{ field: 'occurred_at', op: 'eq', value: '2026-06-11' }]).map((r) => r.id)).toEqual(['1'])
  })

  it('UTC→JST の日付またぎが正しい（UTC 15:00 は JST 翌日）', () => {
    expect(applyFilters(rows, [{ field: 'occurred_at', op: 'eq', value: '2026-06-10' }])).toEqual([])
  })

  it('date カラム（YYYY-MM-DD 文字列）は従来どおり動く', () => {
    const r = [{ id: '1', d: '2026-06-01' }, { id: '2', d: '2026-06-20' }]
    expect(applyFilters(r, [{ field: 'd', op: 'gte', value: '2026-06-10' }]).map((x) => x.id)).toEqual(['2'])
  })

  it('text の contains / select の eq は大文字小文字を無視して動く', () => {
    const r = [{ id: '1', name: 'Tokyo Tower' }, { id: '2', name: 'Osaka' }]
    expect(applyFilters(r, [{ field: 'name', op: 'contains', value: 'tokyo' }]).map((x) => x.id)).toEqual(['1'])
  })
})

describe('parseFilterParams', () => {
  it('f=field|op|value を分解する（値に | を含んでも先頭2つで分割）', () => {
    expect(parseFilterParams(['name|contains|A|B'])).toEqual([{ field: 'name', op: 'contains', value: 'A|B' }])
  })
  it('空値の条件は除外される', () => {
    expect(parseFilterParams(['name|contains| '])).toEqual([])
  })
})
