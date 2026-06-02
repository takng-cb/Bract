'use server'

/**
 * 添付ファイル Server Action
 *
 * Supabase Storage は service_role キー経由で操作する。理由:
 *   - 既存の `supabase` クライアント (anon キー) では Storage RLS により
 *     INSERT/DELETE が拒否される (バケットが public でも書き込みは別問題)。
 *   - Server Action は事前に requireEditor() でロール検証しているので、
 *     Storage 層の認可は二重で不要。
 *   - service_role キーはサーバー専用 (NEXT_PUBLIC_ 接頭辞なし) なので
 *     クライアントには漏れない。
 */
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { db } from '@/lib/db'
import { attachments } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/auth'

export async function uploadAttachment(formData: FormData) {
  await requireEditor()
  const file = formData.get('file') as File
  if (!file || file.size === 0) throw new Error('ファイルを選択してください')
  if (file.size > 20 * 1024 * 1024) throw new Error('ファイルサイズは20MB以下にしてください')

  const account_id          = (formData.get('account_id') as string) || null
  const contact_id          = (formData.get('contact_id') as string) || null
  const opportunity_id      = (formData.get('opportunity_id') as string) || null
  const activity_id         = (formData.get('activity_id') as string) || null
  const maintenance_id      = (formData.get('maintenance_id') as string) || null
  const customer_vehicle_id = (formData.get('customer_vehicle_id') as string) || null
  const revalidate          = (formData.get('revalidate') as string) || '/activities'

  const ext      = file.name.split('.').pop() ?? ''
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-　-鿿＀-￯]/g, '_')
  const storagePath = `${Date.now()}_${baseName}${ext ? '.' + ext : ''}`

  const sb = createSupabaseAdminClient()

  // Supabase Storage にアップロード（service_role で RLS をバイパス）
  const arrayBuffer = await file.arrayBuffer()
  const { error: storageError } = await sb.storage
    .from('attachments')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (storageError) throw new Error(`アップロード失敗: ${storageError.message}`)

  // メタデータを Neon に保存
  try {
    await db.insert(attachments).values({
      file_name:    file.name,
      storage_path: storagePath,
      file_size:    file.size,
      content_type: file.type || null,
      account_id,
      contact_id,
      opportunity_id,
      activity_id,
      maintenance_id,
      customer_vehicle_id,
    })
  } catch (dbError) {
    await sb.storage.from('attachments').remove([storagePath])
    throw dbError
  }

  revalidatePath(revalidate)
}

export async function deleteAttachment(id: string, storagePath: string, revalidate: string) {
  await requireEditor()
  const sb = createSupabaseAdminClient()
  await sb.storage.from('attachments').remove([storagePath])
  await db.delete(attachments).where(eq(attachments.id, id))
  revalidatePath(revalidate)
}
