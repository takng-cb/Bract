/**
 * book_definitions / book_fields を読み取るユーティリティ
 *
 * DB クエリを unstable_cache でサーバーサイドキャッシュし、
 * 全リクエスト共通で再利用することで DB ラウンドトリップを削減する。
 * TTL: 30秒（管理画面での変更は最大30秒で反映）
 *
 * 管理画面での更新時は revalidateTag を呼ぶことでキャッシュを即時破棄できる。
 */
import { db } from '@/lib/db'
import { book_definitions, book_fields } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { parseFieldOptions as _parseFieldOptions } from '@/lib/fieldUtils'
import { unstable_cache } from 'next/cache'

export type BookDef = typeof book_definitions.$inferSelect
export type FieldDef = typeof book_fields.$inferSelect

// ── キャッシュタグ定数 ─────────────────────────────────────────────
export const CACHE_TAG_BOOKS  = 'book_definitions'
export const CACHE_TAG_FIELDS = 'book_fields'

// ── 全ブック定義（管理画面・ナビ用） ──────────────────────────────
const _getAllBookDefs = unstable_cache(
  async () => db.select().from(book_definitions)
    .orderBy(asc(book_definitions.sort_order), asc(book_definitions.created_at)),
  ['all_book_defs'],
  { tags: [CACHE_TAG_BOOKS], revalidate: 30 },
)

/** api_name で 1 件取得 */
export async function getBookDef(apiName: string): Promise<BookDef | null> {
  const all = await _getAllBookDefs()
  return all.find((o) => o.api_name === apiName) ?? null
}

/** id で 1 件取得 */
export async function getBookDefById(id: string): Promise<BookDef | null> {
  const all = await _getAllBookDefs()
  return all.find((o) => o.id === id) ?? null
}

/** ナビ表示が有効なカスタムブック（is_builtin=false）を取得 */
export async function getCustomBooksForNav(): Promise<BookDef[]> {
  const all = await _getAllBookDefs()
  return all.filter((o) => !o.is_builtin)
}

/** 全ブック定義（管理画面用） */
export async function getAllBookDefs(): Promise<BookDef[]> {
  return _getAllBookDefs()
}

// ── フィールド定義（ブックごと） ─────────────────────────────────
const _getFieldDefsRaw = unstable_cache(
  async (bookId: string) => db.select().from(book_fields)
    .where(eq(book_fields.object_id, bookId))
    .orderBy(asc(book_fields.sort_order), asc(book_fields.created_at)),
  ['field_defs'],
  { tags: [CACHE_TAG_FIELDS], revalidate: 30 },
)

/** ブック（book_fields.object_id）に紐づくフィールド定義を sort_order 順で取得 */
export async function getFieldDefs(bookId: string): Promise<FieldDef[]> {
  return _getFieldDefsRaw(bookId)
}

/** select フィールドの options を JSON パースして返す */
export function parseFieldOptions(field: FieldDef): string[] {
  if (field.field_type !== 'select') return []
  return _parseFieldOptions(field.options)
}
