/**
 * object_definitions / field_definitions を読み取るユーティリティ
 *
 * DB クエリを unstable_cache でサーバーサイドキャッシュし、
 * 全リクエスト共通で再利用することで DB ラウンドトリップを削減する。
 * TTL: 30秒（管理画面での変更は最大30秒で反映）
 *
 * 管理画面での更新時は revalidateTag を呼ぶことでキャッシュを即時破棄できる。
 */
import { db } from '@/lib/db'
import { object_definitions, field_definitions } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { parseFieldOptions as _parseFieldOptions } from '@/lib/fieldUtils'
import { unstable_cache } from 'next/cache'

export type ObjectDef = typeof object_definitions.$inferSelect
export type FieldDef  = typeof field_definitions.$inferSelect

// ── キャッシュタグ定数 ─────────────────────────────────────────────
export const CACHE_TAG_OBJECTS = 'object_definitions'
export const CACHE_TAG_FIELDS  = 'field_definitions'

// ── 全オブジェクト定義（管理画面・ナビ用） ────────────────────────
const _getAllObjectDefs = unstable_cache(
  async () => db.select().from(object_definitions)
    .orderBy(asc(object_definitions.sort_order), asc(object_definitions.created_at)),
  ['all_object_defs'],
  { tags: [CACHE_TAG_OBJECTS], revalidate: 30 },
)

/** api_name で 1 件取得 */
export async function getObjectDef(apiName: string): Promise<ObjectDef | null> {
  const all = await _getAllObjectDefs()
  return all.find((o) => o.api_name === apiName) ?? null
}

/** id で 1 件取得 */
export async function getObjectDefById(id: string): Promise<ObjectDef | null> {
  const all = await _getAllObjectDefs()
  return all.find((o) => o.id === id) ?? null
}

/** ナビ表示が有効なカスタムオブジェクト（is_builtin=false）を取得 */
export async function getCustomObjectsForNav(): Promise<ObjectDef[]> {
  const all = await _getAllObjectDefs()
  return all.filter((o) => !o.is_builtin)
}

/** 全オブジェクト定義（管理画面用） */
export async function getAllObjectDefs(): Promise<ObjectDef[]> {
  return _getAllObjectDefs()
}

// ── フィールド定義（オブジェクトごと） ───────────────────────────
const _getFieldDefsRaw = unstable_cache(
  async (objectId: string) => db.select().from(field_definitions)
    .where(eq(field_definitions.object_id, objectId))
    .orderBy(asc(field_definitions.sort_order), asc(field_definitions.created_at)),
  ['field_defs'],
  { tags: [CACHE_TAG_FIELDS], revalidate: 30 },
)

/** object_id に紐づくフィールド定義を sort_order 順で取得 */
export async function getFieldDefs(objectId: string): Promise<FieldDef[]> {
  return _getFieldDefsRaw(objectId)
}

/** select フィールドの options を JSON パースして返す */
export function parseFieldOptions(field: FieldDef): string[] {
  if (field.field_type !== 'select') return []
  return _parseFieldOptions(field.options)
}
