'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function uploadAttachment(formData: FormData) {
  const file = formData.get('file') as File
  if (!file || file.size === 0) throw new Error('ファイルを選択してください')
  if (file.size > 20 * 1024 * 1024) throw new Error('ファイルサイズは20MB以下にしてください')

  const account_id = (formData.get('account_id') as string) || null
  const contact_id = (formData.get('contact_id') as string) || null
  const opportunity_id = (formData.get('opportunity_id') as string) || null
  const activity_id = (formData.get('activity_id') as string) || null
  const revalidate = (formData.get('revalidate') as string) || '/activities'

  // ユニークなストレージパスを生成
  const ext = file.name.split('.').pop() ?? ''
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-　-鿿＀-￯]/g, '_')
  const storagePath = `${Date.now()}_${baseName}${ext ? '.' + ext : ''}`

  // Supabase Storage にアップロード
  const arrayBuffer = await file.arrayBuffer()
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (storageError) throw new Error(`アップロード失敗: ${storageError.message}`)

  // メタデータを DB に保存
  const { error: dbError } = await supabase.from('attachments').insert({
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.size,
    content_type: file.type || null,
    account_id,
    contact_id,
    opportunity_id,
    activity_id,
  })
  if (dbError) {
    // DB 保存失敗時は Storage からも削除
    await supabase.storage.from('attachments').remove([storagePath])
    throw new Error(dbError.message)
  }

  revalidatePath(revalidate)
}

export async function deleteAttachment(id: string, storagePath: string, revalidate: string) {
  // Storage から削除
  await supabase.storage.from('attachments').remove([storagePath])
  // DB から削除
  const { error } = await supabase.from('attachments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(revalidate)
}
