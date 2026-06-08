/**
 * Supabase Storage に `attachments` バケットを作成する。
 *
 * 設計方針:
 *   - public = true (既存コードが /storage/v1/object/public/attachments/ で参照)
 *   - file size limit: 20MB (uploadAttachment と一致)
 *   - allowedMimeTypes は指定しない (汎用添付なので全許可)
 *
 * 既存があれば冪等で OK を返す。
 *
 *   実行: node scripts/create-attachments-bucket.mjs
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要 (service_role キー)')
  process.exit(1)
}
const sb = createClient(url, key)

console.log(`接続先: ${url}\n`)

const { error } = await sb.storage.createBucket('attachments', {
  public: true,
  fileSizeLimit: 20 * 1024 * 1024, // 20 MB
})

if (error) {
  if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
    console.log('✓ attachments バケットは既に存在')
  } else {
    console.error(`❌ 作成失敗: ${error.message}`)
    process.exit(1)
  }
} else {
  console.log('✅ attachments バケット作成完了')
  console.log('   - public: true')
  console.log('   - fileSizeLimit: 20 MB')
}

// 動作確認: 1 byte upload → delete
console.log('\n動作確認 (ダミー 1 byte upload / delete)')
const testPath = `__bucket_check_${Date.now()}.txt`
const { error: upErr } = await sb.storage.from('attachments').upload(testPath, new Uint8Array([0x41]), { contentType: 'text/plain' })
if (upErr) {
  console.error(`❌ upload テスト失敗: ${upErr.message}`)
  process.exit(1)
}
console.log(`  ✓ upload: ${testPath}`)
await sb.storage.from('attachments').remove([testPath])
console.log('  ✓ delete: 削除済み')
console.log('\n✅ バケットは正常に動作')
