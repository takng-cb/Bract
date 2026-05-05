'use server'
import { db } from '@/lib/db'
import { custom_field_values, field_definitions, object_definitions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canEdit } from '@/lib/auth'

/**
 * 組み込みオブジェクトのレコードにカスタムフィールド値を一括保存する
 * FormData の各エントリが api_name → value に対応する
 */
export async function saveCustomFieldValues(
  objectApiName: string,
  recordId: string,
  formData: FormData,
): Promise<void> {
  if (!(await canEdit())) throw new Error('権限がありません')

  // object_definition から field_definitions を取得
  const objRows = await db.select({ id: object_definitions.id })
    .from(object_definitions)
    .where(eq(object_definitions.api_name, objectApiName))
  const obj = objRows[0]
  if (!obj) throw new Error('オブジェクトが見つかりません')

  const fields = await db.select({ id: field_definitions.id, api_name: field_definitions.api_name, field_type: field_definitions.field_type })
    .from(field_definitions)
    .where(eq(field_definitions.object_id, obj.id))

  for (const field of fields) {
    if (field.field_type === 'section') continue  // セクションは値を持たない

    const raw = formData.get(`cf_${field.api_name}`) as string | null
    const value = raw?.trim() || null

    // upsert
    const existing = await db.select({ id: custom_field_values.id })
      .from(custom_field_values)
      .where(and(
        eq(custom_field_values.field_id, field.id),
        eq(custom_field_values.record_id, recordId),
      ))
      .then((r) => r[0] ?? null)

    if (existing) {
      await db.update(custom_field_values)
        .set({ value, updated_at: new Date() })
        .where(eq(custom_field_values.id, existing.id))
    } else if (value !== null) {
      await db.insert(custom_field_values).values({
        field_id:  field.id,
        record_id: recordId,
        value,
      })
    }
  }

  revalidatePath(`/${objectApiName}`)
}
