/**
 * 組み込みオブジェクト用カスタムフィールド値の読み書きユーティリティ
 */
import { db } from '@/lib/db'
import { custom_field_values, field_definitions, object_definitions } from '@/lib/schema'
import { eq, and, inArray } from 'drizzle-orm'
import type { FieldDef } from '@/lib/objectMetadata'

/** record_id に紐づくカスタムフィールド値を { api_name → value } の形で返す */
export async function getCustomFieldValues(
  fieldIds: string[],
  recordId: string,
): Promise<Record<string, string | null>> {
  if (fieldIds.length === 0) return {}

  const rows = await db.select({
    field_id: custom_field_values.field_id,
    value:    custom_field_values.value,
  })
    .from(custom_field_values)
    .where(
      and(
        inArray(custom_field_values.field_id, fieldIds),
        eq(custom_field_values.record_id, recordId),
      ),
    )

  return Object.fromEntries(rows.map((r) => [r.field_id, r.value]))
}

/**
 * object_api_name から field_definitions を取得し、
 * record_id に紐づくカスタムフィールド値を合わせて返す
 */
export async function getCustomFieldsWithValues(
  objectApiName: string,
  recordId: string,
): Promise<{ fields: FieldDef[]; values: Record<string, string | null> }> {
  // object_definition を api_name で取得（1クエリ目のみ必要）
  const objRows = await db.select({ id: object_definitions.id })
    .from(object_definitions)
    .where(eq(object_definitions.api_name, objectApiName))
  const obj = objRows[0]
  if (!obj) return { fields: [], values: {} }

  // field_definitions と custom_field_values を並列取得
  const [fields, valueRows] = await Promise.all([
    db.select()
      .from(field_definitions)
      .where(eq(field_definitions.object_id, obj.id))
      .orderBy(field_definitions.sort_order, field_definitions.created_at),
    db.select({
      field_id: custom_field_values.field_id,
      value:    custom_field_values.value,
    })
      .from(custom_field_values)
      .where(eq(custom_field_values.record_id, recordId)),
  ])

  // field_id → value のマップを作成
  const valueMap = new Map(valueRows.map((r) => [r.field_id, r.value]))

  // field_id → api_name に変換
  const values: Record<string, string | null> = {}
  for (const f of fields) {
    values[f.api_name] = valueMap.get(f.id) ?? null
  }

  return { fields, values }
}
