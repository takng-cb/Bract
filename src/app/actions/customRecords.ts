'use server'
import { db } from '@/lib/db'
import { trashRecord } from '@/lib/trash'
import { book_records } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'
import { getBookDef, getFieldDefs } from '@/lib/bookMetadata'
import { redirect } from 'next/navigation'
import { withSaveToast } from '@/lib/saveToast'
import { cleanupRelatedRecordsForParent } from '@/lib/relatedRecords'
import { cleanupRecordLinksForParent } from '@/lib/recordLinks'
import { assertNotPendingApproval } from '@/app/actions/approvals'

// ────────────────────────────────────────────────────────────────
// カスタムレコード CRUD
// ────────────────────────────────────────────────────────────────

/** FormData から data JSON を構築して INSERT */
export async function createCustomRecord(
  bookApiName: string,
  formData: FormData,
): Promise<void> {
  await requirePermission(bookApiName, 'create')

  const obj = await getBookDef(bookApiName)
  if (!obj) throw new Error(`ブック "${bookApiName}" が見つかりません`)

  const fields = await getFieldDefs(obj.id)
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = formData.get(f.api_name) as string | null
    data[f.api_name] = coerceValue(f.field_type, raw)
  }

  const owner_id = (formData.get('owner_id') as string) || null

  const [rec] = await db.insert(book_records)
    .values({ object_id: obj.id, data, owner_id })
    .returning({ id: book_records.id })

  revalidatePath(`/books/${bookApiName}`)
  redirect(withSaveToast(`/books/${bookApiName}/${rec.id}`, 'created'))
}

/** FormData から data JSON を構築して UPDATE */
export async function updateCustomRecord(
  bookApiName: string,
  recordId: string,
  formData: FormData,
): Promise<void> {
  await requirePermission(bookApiName, 'update')
  // 承認待ち中は編集ロック（REQ-0023 / #131）。approvals.object_type はカスタムブックの api_name
  await assertNotPendingApproval(bookApiName, recordId)

  const obj = await getBookDef(bookApiName)
  if (!obj) throw new Error(`ブック "${bookApiName}" が見つかりません`)

  const fields = await getFieldDefs(obj.id)
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = formData.get(f.api_name) as string | null
    data[f.api_name] = coerceValue(f.field_type, raw)
  }

  const owner_id = (formData.get('owner_id') as string) || null

  await db.update(book_records)
    .set({ data, owner_id, updated_at: new Date() })
    .where(and(eq(book_records.id, recordId), eq(book_records.object_id, obj.id)))

  revalidatePath(`/books/${bookApiName}/${recordId}`)
  redirect(withSaveToast(`/books/${bookApiName}/${recordId}`, 'saved'))
}

/** 削除 */
export async function deleteCustomRecord(
  bookApiName: string,
  recordId: string,
): Promise<void> {
  await requirePermission(bookApiName, 'delete')
  // 承認待ち中は削除も不可（REQ-0023 / #131）。approvals.object_type はカスタムブックの api_name
  await assertNotPendingApproval(bookApiName, recordId)

  const obj = await getBookDef(bookApiName)
  if (!obj) throw new Error(`ブック "${bookApiName}" が見つかりません`)

  await trashRecord('book_records', recordId, obj.label_plural ?? bookApiName)  // 実削除の前にゴミ箱へ退避（REQ-0047）

  // Phase 2: junction クリーンアップ。api_name 経由で参照されているため
  // bookApiName (= book_definitions.api_name) を渡す。
  await cleanupRelatedRecordsForParent(bookApiName, recordId)
  await cleanupRecordLinksForParent(bookApiName, recordId)
  await db.delete(book_records)
    .where(and(eq(book_records.id, recordId), eq(book_records.object_id, obj.id)))

  revalidatePath(`/books/${bookApiName}`)
  redirect(withSaveToast(`/books/${bookApiName}`, 'deleted'))
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
