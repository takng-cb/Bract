/**
 * グローバル検索用：テーブルの全テキスト型カラムを OR ILIKE する where を構築（REQ-0026 拡張）。
 *
 * カラムを手で列挙せず Drizzle のメタデータから自動収集するため、
 * テーブルに住所・備考などのカラムが増えても自動で検索対象になる。
 * 対象は PgText / PgVarchar / PgChar のみ（uuid・数値・日付・jsonb は除外。
 * jsonb は book_records.data のように呼び出し側で ::text キャスト検索する）。
 */
import { getTableColumns, ilike, or, type SQL } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'

const TEXT_COLUMN_TYPES = new Set(['PgText', 'PgVarchar', 'PgChar'])

/** テーブルのテキスト型カラム一覧 */
export function textColumns(table: PgTable): AnyPgColumn[] {
  return Object.values(getTableColumns(table)).filter((c) =>
    TEXT_COLUMN_TYPES.has((c as AnyPgColumn).columnType),
  ) as AnyPgColumn[]
}

/** 全テキストカラムの OR ILIKE（テキストカラムが無ければ undefined） */
export function textColumnsWhere(table: PgTable, pattern: string): SQL | undefined {
  const cols = textColumns(table)
  if (cols.length === 0) return undefined
  return or(...cols.map((c) => ilike(c, pattern)))
}
