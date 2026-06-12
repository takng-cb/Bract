'use server'
import { db } from '@/lib/db'
import { custom_field_values, book_fields, book_definitions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canEdit } from '@/lib/auth'
import { assertNotPendingApproval } from '@/app/actions/approvals'

/**
 * 組み込みブックのレコードにカスタムフィールド値を一括保存する
 * FormData の各エントリが api_name → value に対応する
 */
export async function saveCustomFieldValues(
  bookApiName: string,
  recordId: string,
  formData: FormData,
): Promise<void> {
  if (!(await canEdit())) throw new Error('権限がありません')
  await assertNotPendingApproval(bookApiName, recordId)  // 承認待ち中は編集ロック（REQ-0023 / #131）

  // book_definition から book_fields を取得
  const objRows = await db.select({ id: book_definitions.id })
    .from(book_definitions)
    .where(eq(book_definitions.api_name, bookApiName))
  const obj = objRows[0]
  if (!obj) throw new Error('ブックが見つかりません')

  const fields = await db.select({ id: book_fields.id, api_name: book_fields.api_name, field_type: book_fields.field_type })
    .from(book_fields)
    .where(eq(book_fields.object_id, obj.id))

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

  revalidatePath(`/${bookApiName}`)
}
