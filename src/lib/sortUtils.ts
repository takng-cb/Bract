import { asc, desc, type SQL } from 'drizzle-orm'
import type { FilterColumnResolver } from '@/lib/filterUtils'

export type SortDef = { field: string; dir: 'asc' | 'desc' }

/** "name:asc,status:desc" → SortDef[] */
export function parseSortParams(raw: string): SortDef[] {
  if (!raw) return []
  return raw.split(',').flatMap((s) => {
    const [field, dir] = s.split(':')
    if (!field) return []
    return [{ field, dir: dir === 'desc' ? 'desc' : 'asc' } as SortDef]
  })
}

/** SortDef[] → "name:asc,status:desc" */
export function sortParamsToString(sorts: SortDef[]): string {
  return sorts.map((s) => `${s.field}:${s.dir}`).join(',')
}

/**
 * クリック時のソート切り替え:
 *   未ソート → asc → desc → ソート解除
 *   maxSorts を超える場合は最古のソートを置き換える
 */
export function toggleSort(sorts: SortDef[], field: string, maxSorts = 3): SortDef[] {
  const idx = sorts.findIndex((s) => s.field === field)

  if (idx === -1) {
    // 新規追加（asc）
    const base = sorts.length >= maxSorts ? sorts.slice(1) : sorts
    return [...base, { field, dir: 'asc' }]
  } else if (sorts[idx].dir === 'asc') {
    // asc → desc
    return sorts.map((s, i) => (i === idx ? { ...s, dir: 'desc' as const } : s))
  } else {
    // desc → 解除
    return sorts.filter((_, i) => i !== idx)
  }
}

/**
 * SortDef[] を Drizzle の ORDER BY 句に変換する。
 *
 * - resolver に定義されていない field は **黙ってスキップ**する
 * - 解決可能なソートが 1 つもなければ空配列を返す（呼び出し側で .orderBy(...[]) は無効化される）
 */
export function buildOrderBy(
  sorts: SortDef[],
  resolver: FilterColumnResolver,
): SQL[] {
  return sorts
    .map((s) => {
      const spec = resolver[s.field]
      if (!spec) return null
      return s.dir === 'asc' ? asc(spec.col) : desc(spec.col)
    })
    .filter((s): s is SQL => s !== null)
}

/** フロントエンド向けソート適用（サーバーサイドでも使用） */
export function applySort(
  records: Record<string, unknown>[],
  sorts: SortDef[],
): Record<string, unknown>[] {
  if (sorts.length === 0) return records
  return [...records].sort((a, b) => {
    for (const { field, dir } of sorts) {
      const av = a[field]
      const bv = b[field]
      const mul = dir === 'asc' ? 1 : -1
      if (av == null && bv == null) continue
      if (av == null) return 1 * mul
      if (bv == null) return -1 * mul
      if (typeof av === 'string' && typeof bv === 'string') {
        const cmp = av.localeCompare(bv, 'ja')
        if (cmp !== 0) return cmp * mul
      } else if (typeof av === 'number' && typeof bv === 'number') {
        if (av !== bv) return (av - bv) * mul
      } else {
        const cmp = String(av).localeCompare(String(bv))
        if (cmp !== 0) return cmp * mul
      }
    }
    return 0
  })
}
