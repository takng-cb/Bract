// ============================================================
// 一覧ページ共通フィルタユーティリティ
// URL形式: ?f=field|op|value&f=field|op|value ...
// ============================================================

import { and, eq, ne, gte, lte, ilike, notIlike, inArray, notInArray, type AnyColumn, type SQL } from 'drizzle-orm'
import { taggables } from '@/lib/schema'
import { db } from '@/lib/db'

export type FilterCondition = {
  field: string
  op: string
  value: string
}

/** カラムの型ヒント（演算子の解釈に使用） */
export type FilterColumnType = 'text' | 'number' | 'date' | 'boolean' | 'select'

/** 1カラムのSQL生成スペック */
export type FilterColumnSpec = {
  col:  AnyColumn
  type: FilterColumnType
}

/** field名 → ColumnSpec のマップ。各ページで定義し buildWhere/buildOrderBy に渡す */
export type FilterColumnResolver = Record<string, FilterColumnSpec>

/** PostgreSQL の LIKE/ILIKE で使う特殊文字 (% _ \) をエスケープ */
function escapeLike(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
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

  // timestamp カラムは Date オブジェクトで返るため、String(Date) の
  // "Thu Jun 12 2026 ..." 形式では日付入力値（YYYY-MM-DD）と比較できない（#132）。
  // JST の YYYY-MM-DD に正規化してから比較する（date カラムは元々この形式の文字列）。
  const fieldStr = raw instanceof Date
    ? raw.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    : raw != null ? String(raw) : ''
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

// ============================================================
// SQL 生成: FilterCondition[] → Drizzle WHERE 句
// ============================================================

/** 1 条件を Drizzle SQL 式に変換。未対応なら null を返す（呼び出し側で除外） */
function conditionToSQL(c: FilterCondition, spec: FilterColumnSpec): SQL | null {
  const v = c.value
  const isText = spec.type === 'text' || spec.type === 'select'

  switch (c.op) {
    case 'contains':
      if (!isText) return null
      return ilike(spec.col, `%${escapeLike(v)}%`)
    case 'not_contains':
      if (!isText) return null
      return notIlike(spec.col, `%${escapeLike(v)}%`)
    case 'starts_with':
      if (!isText) return null
      return ilike(spec.col, `${escapeLike(v)}%`)
    case 'eq':
      // text/select は大小文字を無視（JS版の挙動に合わせる）
      if (isText) return ilike(spec.col, escapeLike(v))
      return eq(spec.col, v)
    case 'neq':
      if (isText) return notIlike(spec.col, escapeLike(v))
      return ne(spec.col, v)
    case 'gte':
      return gte(spec.col, v)
    case 'lte':
      return lte(spec.col, v)
    default:
      return null
  }
}

/**
 * FilterCondition[] を Drizzle の WHERE 句に変換する。
 *
 * - resolver に定義されていない field は **黙ってスキップ**する
 *   （tag や custom field 等、別経路で扱う想定の field のため）
 * - 全条件は AND 結合
 * - 該当条件がなければ undefined を返す（呼び出し側で `where(undefined)` は無効化される）
 */
export function buildWhere(
  conditions: FilterCondition[],
  resolver: FilterColumnResolver,
): SQL | undefined {
  const clauses: SQL[] = []
  for (const c of conditions) {
    const spec = resolver[c.field]
    if (!spec) continue
    const clause = conditionToSQL(c, spec)
    if (clause) clauses.push(clause)
  }
  if (clauses.length === 0) return undefined
  return clauses.length === 1 ? clauses[0] : and(...clauses)
}

/**
 * resolver に解決できない条件のみを抜き出す（JS フォールバック用）。
 * tag/custom field 等が今後追加される際に、SQL で扱えなかった分を JS で適用するために使う。
 */
export function unresolvedConditions(
  conditions: FilterCondition[],
  resolver: FilterColumnResolver,
): FilterCondition[] {
  return conditions.filter((c) => !resolver[c.field])
}

/**
 * タグ条件を Drizzle の WHERE 句（サブクエリ）に変換する。
 *
 * 各タグ条件を独立したサブクエリ ( EXISTS / NOT EXISTS 相当 ) に展開し、
 * AND 結合する。
 *   - tag eq <id>:  対象レコードがそのタグを持つ
 *   - tag neq <id>: 対象レコードがそのタグを持たない
 * 複数条件は全て満たす必要がある（AND）。
 *
 * @param tagConditions splitTagConditions で分離された tag フィールドの条件
 * @param objectType    'opportunity' | 'account' | 'contact' 等 (taggables.object_type)
 * @param recordIdCol   レコード ID の Drizzle カラム参照（例: opportunities.id）
 */
export function buildTagWhere(
  tagConditions: FilterCondition[],
  objectType: string,
  recordIdCol: AnyColumn,
): SQL | undefined {
  const clauses: SQL[] = []
  for (const c of tagConditions) {
    if (c.field !== 'tag') continue
    if (!c.value) continue
    // 該当タグを持つレコード ID のサブクエリ
    const taggedSubquery = db.select({ id: taggables.object_id })
      .from(taggables)
      .where(and(
        eq(taggables.object_type, objectType),
        eq(taggables.tag_id, c.value),
      ))
    if (c.op === 'eq') {
      clauses.push(inArray(recordIdCol, taggedSubquery))
    } else if (c.op === 'neq') {
      clauses.push(notInArray(recordIdCol, taggedSubquery))
    }
  }
  if (clauses.length === 0) return undefined
  return clauses.length === 1 ? clauses[0] : and(...clauses)
}
