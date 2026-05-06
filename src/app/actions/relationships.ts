'use server'

import { db } from '@/lib/db'
import { relationship_definitions, relationship_values } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canEdit } from '@/lib/auth'

// ────────────────────────────────────────────────────────────
// 定義 CRUD
// ────────────────────────────────────────────────────────────

export async function createRelationshipDefinition(formData: FormData) {
  const edit = await canEdit()
  if (!edit) throw new Error('権限がありません')

  const sourceObjectType = formData.get('source_object_type') as string
  const targetObjectType = formData.get('target_object_type') as string
  const label            = formData.get('label') as string
  const reverseLabel     = formData.get('reverse_label') as string | null
  const cardinality      = (formData.get('cardinality') as string) || 'many_to_many'

  if (!sourceObjectType || !targetObjectType || !label) {
    throw new Error('必須項目が不足しています')
  }

  await db.insert(relationship_definitions).values({
    source_object_type: sourceObjectType,
    target_object_type: targetObjectType,
    label,
    reverse_label: reverseLabel || null,
    cardinality,
  })

  revalidatePath('/admin/relationships')
}

export async function deleteRelationshipDefinition(id: string) {
  const edit = await canEdit()
  if (!edit) throw new Error('権限がありません')

  await db.delete(relationship_definitions).where(eq(relationship_definitions.id, id))
  revalidatePath('/admin/relationships')
}

// ────────────────────────────────────────────────────────────
// 値 CRUD
// ────────────────────────────────────────────────────────────

export async function addRelationshipValue(
  relationshipId: string,
  sourceRecordId: string,
  targetRecordId: string,
  revalidate?: string,
) {
  const edit = await canEdit()
  if (!edit) throw new Error('権限がありません')

  await db.insert(relationship_values).values({
    relationship_id:  relationshipId,
    source_record_id: sourceRecordId,
    target_record_id: targetRecordId,
  }).onConflictDoNothing()

  if (revalidate) revalidatePath(revalidate)
}

export async function removeRelationshipValue(
  relationshipId: string,
  sourceRecordId: string,
  targetRecordId: string,
  revalidate?: string,
) {
  const edit = await canEdit()
  if (!edit) throw new Error('権限がありません')

  await db.delete(relationship_values).where(
    and(
      eq(relationship_values.relationship_id, relationshipId),
      eq(relationship_values.source_record_id, sourceRecordId),
      eq(relationship_values.target_record_id, targetRecordId),
    )
  )

  if (revalidate) revalidatePath(revalidate)
}

// ────────────────────────────────────────────────────────────
// クエリ
// ────────────────────────────────────────────────────────────

/** あるオブジェクト種別に紐づく定義を全件取得 */
export async function getRelationshipDefinitionsFor(objectType: string) {
  const all = await db.select().from(relationship_definitions)
  // source_object_type OR target_object_type が一致するものを返す
  return all.filter(
    (d) => d.source_object_type === objectType || d.target_object_type === objectType,
  )
}

/** あるレコードに紐づく値を取得（source / target 双方向） */
export async function getRelatedRecordIds(
  relationshipId: string,
  recordId: string,
): Promise<{ sourceIds: string[]; targetIds: string[] }> {
  const rows = await db.select().from(relationship_values).where(
    eq(relationship_values.relationship_id, relationshipId),
  )

  const sourceIds = rows
    .filter((r) => r.target_record_id === recordId)
    .map((r) => r.source_record_id)

  const targetIds = rows
    .filter((r) => r.source_record_id === recordId)
    .map((r) => r.target_record_id)

  return { sourceIds, targetIds }
}
