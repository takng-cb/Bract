/**
 * object_definitions / field_definitions を読み取るユーティリティ
 * Server Component / Server Action から利用する（キャッシュは Next.js の fetch キャッシュに委ねず都度 DB 参照）
 */
import { db } from '@/lib/db'
import { object_definitions, field_definitions } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { parseFieldOptions as _parseFieldOptions } from '@/lib/fieldUtils'

export type ObjectDef = typeof object_definitions.$inferSelect
export type FieldDef  = typeof field_definitions.$inferSelect

/** api_name で 1 件取得 */
export async function getObjectDef(apiName: string): Promise<ObjectDef | null> {
  const rows = await db.select().from(object_definitions)
    .where(eq(object_definitions.api_name, apiName))
  return rows[0] ?? null
}

/** id で 1 件取得 */
export async function getObjectDefById(id: string): Promise<ObjectDef | null> {
  const rows = await db.select().from(object_definitions)
    .where(eq(object_definitions.id, id))
  return rows[0] ?? null
}

/** object_id に紐づくフィールド定義を sort_order 順で取得 */
export async function getFieldDefs(objectId: string): Promise<FieldDef[]> {
  return db.select().from(field_definitions)
    .where(eq(field_definitions.object_id, objectId))
    .orderBy(asc(field_definitions.sort_order), asc(field_definitions.created_at))
}

/** ナビ表示が有効なカスタムオブジェクト（is_builtin=false）を取得 */
export async function getCustomObjectsForNav(): Promise<ObjectDef[]> {
  return db.select().from(object_definitions)
    .where(eq(object_definitions.is_builtin, false))
    .orderBy(asc(object_definitions.sort_order), asc(object_definitions.created_at))
}

/** 全オブジェクト定義（管理画面用） */
export async function getAllObjectDefs(): Promise<ObjectDef[]> {
  return db.select().from(object_definitions)
    .orderBy(asc(object_definitions.sort_order), asc(object_definitions.created_at))
}

/** select フィールドの options を JSON パースして返す */
export function parseFieldOptions(field: FieldDef): string[] {
  if (field.field_type !== 'select') return []
  return _parseFieldOptions(field.options)
}
