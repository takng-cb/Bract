// ============================================================
// 一覧ページ共通フィルタユーティリティ
// URL形式: ?f=field|op|value&f=field|op|value ...
// ============================================================

export type FilterCondition = {
  field: string
  op: string
  value: string
}

/** URLの f パラメータ（1つ or 配列）を FilterCondition[] に変換 */
export function parseFilterParams(f: string | string[] | undefined): FilterCondition[] {
  const fs = Array.isArray(f) ? f : f ? [f] : []
  return fs
    .map((s) => {
      const idx1 = s.indexOf('|')
      const idx2 = s.indexOf('|', idx1 + 1)
      if (idx1 < 0 || idx2 < 0) return null
      return {
        field: s.slice(0, idx1),
        op:    s.slice(idx1 + 1, idx2),
        value: s.slice(idx2 + 1),
      }
    })
    .filter((c): c is FilterCondition => c !== null && c.value.trim() !== '')
}

/** レコード1件が条件1つを満たすか判定（ドット記法でネストしたフィールドも参照可） */
function matchesCondition(
  record: Record<string, unknown>,
  cond: FilterCondition,
): boolean {
  // ドット記法 (例: accounts.name) でネストされた値を取得
  let raw: unknown
  if (cond.field.includes('.')) {
    const [rel, col] = cond.field.split('.')
    raw = (record[rel] as Record<string, unknown> | null)?.[col]
  } else {
    raw = record[cond.field]
  }

  const fieldStr = raw != null ? String(raw) : ''
  const val      = cond.value

  switch (cond.op) {
    case 'contains':
      return fieldStr.toLowerCase().includes(val.toLowerCase())
    case 'not_contains':
      return !fieldStr.toLowerCase().includes(val.toLowerCase())
    case 'starts_with':
      return fieldStr.toLowerCase().startsWith(val.toLowerCase())
    case 'eq':
      return fieldStr.toLowerCase() === val.toLowerCase()
    case 'neq':
      return fieldStr.toLowerCase() !== val.toLowerCase()
    case 'gte':
      // 数値っぽければ数値比較、そうでなければ文字列比較（日付も ISO 形式なら動く）
      return isNaN(Number(fieldStr))
        ? fieldStr >= val
        : Number(fieldStr) >= Number(val)
    case 'lte':
      return isNaN(Number(fieldStr))
        ? fieldStr <= val
        : Number(fieldStr) <= Number(val)
    default:
      return true
  }
}

/** tag フィールドの条件を通常条件と分離する */
export function splitTagConditions(conditions: FilterCondition[]): {
  tagConditions: FilterCondition[]
  otherConditions: FilterCondition[]
} {
  return {
    tagConditions:   conditions.filter((c) => c.field === 'tag'),
    otherConditions: conditions.filter((c) => c.field !== 'tag'),
  }
}

/** タグ条件をレコード配列に適用する（objectIds は taggables から取得した ID セット） */
export function applyTagFilter<T extends Record<string, unknown>>(
  records: T[],
  tagConditions: FilterCondition[],
  taggedIdsByTagId: Map<string, Set<string>>,
): T[] {
  if (tagConditions.length === 0) return records
  return records.filter((r) => {
    const id = r.id as string
    return tagConditions.every((c) => {
      const ids = taggedIdsByTagId.get(c.value) ?? new Set<string>()
      return c.op === 'eq' ? ids.has(id) : !ids.has(id)
    })
  })
}

/** レコード配列に全条件（AND）を適用して絞り込む */
export function applyFilters<T extends Record<string, unknown>>(
  records: T[],
  conditions: FilterCondition[],
): T[] {
  if (conditions.length === 0) return records
  return records.filter((r) =>
    conditions.every((c) => matchesCondition(r, c)),
  )
}
