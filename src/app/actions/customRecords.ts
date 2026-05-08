'use server'
import { db } from '@/lib/db'
import { custom_records, object_definitions, field_definitions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canEdit } from '@/lib/auth'
import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { redirect } from 'next/navigation'

// ────────────────────────────────────────────────────────────────
// カスタムレコード CRUD
// ────────────────────────────────────────────────────────────────

/** FormData から data JSON を構築して INSERT */
export async function createCustomRecord(
  objectApiName: string,
  formData: FormData,
): Promise<void> {
  if (!(await canEdit())) throw new Error('権限がありません')

  const obj = await getObjectDef(objectApiName)
  if (!obj) throw new Error(`オブジェクト "${objectApiName}" が見つかりません`)

  const fields = await getFieldDefs(obj.id)
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = formData.get(f.api_name) as string | null
    data[f.api_name] = coerceValue(f.field_type, raw)
  }

  const [rec] = await db.insert(custom_records)
    .values({ object_id: obj.id, data })
    .returning({ id: custom_records.id })

  revalidatePath(`/objects/${objectApiName}`)
  redirect(`/objects/${objectApiName}/${rec.id}`)
}

/** FormData から data JSON を構築して UPDATE */
export async function updateCustomRecord(
  objectApiName: string,
  recordId: string,
  formData: FormData,
): Promise<void> {
  if (!(await canEdit())) throw new Error('権限がありません')

  const obj = await getObjectDef(objectApiName)
  if (!obj) throw new Error(`オブジェクト "${objectApiName}" が見つかりません`)

  const fields = await getFieldDefs(obj.id)
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = formData.get(f.api_name) as string | null
    data[f.api_name] = coerceValue(f.field_type, raw)
  }

  await db.update(custom_records)
    .set({ data, updated_at: new Date() })
    .where(and(eq(custom_records.id, recordId), eq(custom_records.object_id, obj.id)))

  revalidatePath(`/objects/${objectApiName}/${recordId}`)
  redirect(`/objects/${objectApiName}/${recordId}`)
}

/** 削除 */
export async function deleteCustomRecord(
  objectApiName: string,
  recordId: string,
): Promise<void> {
  if (!(await canEdit())) throw new Error('権限がありません')

  const obj = await getObjectDef(objectApiName)
  if (!obj) throw new Error(`オブジェクト "${objectApiName}" が見つかりません`)

  await db.delete(custom_records)
    .where(and(eq(custom_records.id, recordId), eq(custom_records.object_id, obj.id)))

  revalidatePath(`/objects/${objectApiName}`)
  redirect(`/objects/${objectApiName}`)
}

// ────────────────────────────────────────────────────────────────
// 型変換ヘルパー
// ────────────────────────────────────────────────────────────────
function coerceValue(fieldType: string, raw: string | null): unknown {
  if (raw === null || raw.trim() === '') return null
  const s = raw.trim()
  switch (fieldType) {
    case 'number':  { const n = Number(s); return isFinite(n) ? n : null }
    case 'boolean': return s === 'on' || s === 'true' || s === '1'
    default:        return s
  }
}
