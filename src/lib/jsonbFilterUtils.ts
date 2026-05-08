/**
 * custom_records.data (JSONB) に対する SQL フィルタ・ソートビルダー
 *
 * FilterCondition[] → Drizzle SQL WHERE 句
 * SortDef[]        → Drizzle SQL ORDER BY 句
 */
import { sql, asc, desc, and, SQL } from 'drizzle-orm'
import { custom_records } from '@/lib/schema'
import type { FilterCondition } from '@/lib/filterUtils'
import type { SortDef } from '@/lib/sortUtils'

// ----------------------------------------------------------------
// JSONB フィールドアクセス式
// ----------------------------------------------------------------
/** data->>'fieldName'  （テキストとして取得） */
function jsonbText(field: string): SQL {
  // field は field_definitions.api_name 由来なので Drizzle のパラメータ化で渡す
  return sql`(${custom_records.data}->>${field})`
}

/** (data->>'fieldName')::numeric  （数値キャスト） */
function jsonbNumeric(field: string): SQL {
  return sql`((${custom_records.data}->>${field})::numeric)`
}

// ----------------------------------------------------------------
// 1 フィールドの FilterCondition → SQL
// ----------------------------------------------------------------
function buildOneCondition(
  field: string,
  fieldType: string,
  op: string,
  value: string,
): SQL | undefined {
  if (!value.trim()) return undefined

  // created_at など custom_records の通常カラムはそのまま処理
  // （将来的な拡張点。現状ではフィールド定義にない）

  switch (fieldType) {
    case 'number': {
      const n = Number(value)
      if (!isFinite(n)) return undefined
      const expr = jsonbNumeric(field)
      if (op === 'gte') return sql`${expr} >= ${n}`
      if (op === 'lte') return sql`${expr} <= ${n}`
      if (op === 'eq')  return sql`${expr} = ${n}`
      if (op === 'neq') return sql`${expr} != ${n}`
      return undefined
    }

    case 'boolean': {
      // JSONB boolean → ->>'field' は 'true' / 'false' 文字列
      if (op === 'eq') {
        const boolStr = (value === 'true' || value === '1') ? 'true' : 'false'
        return sql`${jsonbText(field)} = ${boolStr}`
      }
      return undefined
    }

    default: { // text, select, date, textarea
      const expr = jsonbText(field)
      if (op === 'contains')
        return sql`${expr} ILIKE ${'%' + value + '%'}`
      if (op === 'not_contains')
        return sql`(${expr} IS NULL OR ${expr} NOT ILIKE ${'%' + value + '%'})`
      if (op === 'starts_with')
        return sql`${expr} ILIKE ${value + '%'}`
      if (op === 'eq')
        return sql`${expr} ILIKE ${value}`
      if (op === 'neq')
        return sql`(${expr} IS NULL OR ${expr} NOT ILIKE ${value})`
      if (op === 'gte')
        return sql`${expr} >= ${value}`   // 日付比較 (ISO 文字列は辞書順 = 日付順)
      if (op === 'lte')
        return sql`${expr} <= ${value}`
      return undefined
    }
  }
}

// ----------------------------------------------------------------
// FilterCondition[] → AND で結合した SQL WHERE 句
// ----------------------------------------------------------------
/** fieldType マップ: api_name → field_type */
export function buildJsonbWhere(
  conditions: FilterCondition[],
  fieldTypeMap: Map<string, string>,
): SQL | undefined {
  const parts = conditions
    .map((c) => {
      const ft = fieldTypeMap.get(c.field) ?? 'text'
      return buildOneCondition(c.field, ft, c.op, c.value)
    })
    .filter((s): s is SQL => s !== undefined)

  if (parts.length === 0) return undefined
  if (parts.length === 1) return parts[0]
  return and(...parts)
}

// ----------------------------------------------------------------
// SortDef[] → ORDER BY 句の配列
// ----------------------------------------------------------------
export function buildJsonbOrderBy(
  sorts: SortDef[],
  fieldTypeMap: Map<string, string>,
): SQL[] {
  if (sorts.length === 0) return []

  return sorts.map(({ field, dir }) => {
    // created_at / updated_at は custom_records の通常カラム
    if (field === 'created_at')
      return dir === 'asc' ? asc(custom_records.created_at) : desc(custom_records.created_at)
    if (field === 'updated_at')
      return dir === 'asc' ? asc(custom_records.updated_at) : desc(custom_records.updated_at)

    const ft = fieldTypeMap.get(field) ?? 'text'
    const expr = ft === 'number' ? jsonbNumeric(field) : jsonbText(field)
    return dir === 'asc'
      ? sql`${expr} ASC NULLS LAST`
      : sql`${expr} DESC NULLS LAST`
  })
}
