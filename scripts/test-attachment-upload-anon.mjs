/**
 * anon キー (アプリ実行時のクライアント) で attachments バケットに
 * アップロード可能か確認。
 *
 * Supabase Storage はデフォルトで public バケットでも書き込みには
 * RLS ポリシーが必要。ポリシー未設定なら uploadAttachment が失敗する。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
console.log(`接続先: ${url}`)
console.log(`使用キー: anon\n`)

const sb = createClient(url, anonKey)

const testPath = `__anon_check_${Date.now()}.txt`
const { error: upErr } = await sb.storage
  .from('attachments')
  .upload(testPath, new Uint8Array([0x41]), { contentType: 'text/plain' })

if (upErr) {
  console.log(`❌ anon upload 失敗: ${upErr.message}`)
  console.log('   → Storage RLS ポリシー未設定 (書き込み拒否)')
  console.log('   → 修正: INSERT/DELETE 用のポリシーを追加する必要あり')
} else {
  console.log(`✅ anon upload 成功: ${testPath}`)
  await sb.storage.from('attachments').remove([testPath])
  console.log('   (削除済み)')
}
