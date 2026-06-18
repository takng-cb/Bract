'use server'

/**
 * 外部ポータル/社内詳細からの「ファイル添付」（REQ-0084 Phase3）。
 * 外部=grant / 社内=閲覧可（canCommentOn）を確認してから service_role で Storage にアップロード。
 * 対応: account / contact / opportunity（attachments の親列があるもの）。
 */
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { db } from '@/lib/db'
import { attachments } from '@/lib/schema'
import { revalidatePath } from 'next/cache'
import { getSupabaseUser } from '@/lib/auth'
import { canCommentOn } from '@/lib/recordComments'

const PARENT_COL = { account: 'account_id', contact: 'contact_id', opportunity: 'opportunity_id' } as const
type FileObjectApi = keyof typeof PARENT_COL

export async function uploadPortalAttachment(
  objectApi: string, recordId: string, formData: FormData, revalidate?: string,
): Promise<void> {
  const user = await getSupabaseUser()
  if (!user) throw new Error('ログインが必要です')
  if (!(objectApi in PARENT_COL)) throw new Error('このオブジェクトはファイル添付に未対応です')
  // 外部=grant / 社内=閲覧可（直 POST 対策）
  if (!(await canCommentOn(objectApi, recordId))) throw new Error('このレコードに添付する権限がありません')

  const file = formData.get('file') as File
  if (!file || file.size === 0) throw new Error('ファイルを選択してください')
  if (file.size > 20 * 1024 * 1024) throw new Error('ファイルサイズは20MB以下にしてください')

  const ext      = file.name.split('.').pop() ?? ''
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-　-鿿＀-￯]/g, '_')
  const storagePath = `${Date.now()}_${baseName}${ext ? '.' + ext : ''}`

  const sb = createSupabaseAdminClient()
  const { error } = await sb.storage.from('attachments')
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw new Error(`アップロード失敗: ${error.message}`)

  const col = PARENT_COL[objectApi as FileObjectApi]
  const base = { file_name: file.name, storage_path: storagePath, file_size: file.size, content_type: file.type || null }
  const values =
    col === 'account_id'     ? { ...base, account_id: recordId }
    : col === 'contact_id'   ? { ...base, contact_id: recordId }
    : { ...base, opportunity_id: recordId }
  await db.insert(attachments).values(values)

  if (revalidate) revalidatePath(revalidate)
}
