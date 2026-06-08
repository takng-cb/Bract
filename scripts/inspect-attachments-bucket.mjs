/**
 * Supabase Storage の `attachments` バケットが存在するか + アクセス可能かを確認。
 *   実行: node scripts/inspect-attachments-bucket.mjs
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log(`接続先 Supabase: ${url}`)
console.log(`使用するキー: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'}\n`)

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL または key が未設定')
  process.exit(1)
}

const sb = createClient(url, key)

// バケット一覧
console.log('── バケット一覧 ──')
const { data: buckets, error: bucketsErr } = await sb.storage.listBuckets()
if (bucketsErr) {
  console.log(`(取得不可: ${bucketsErr.message} — anon キーだと list 不可なのは正常)`)
} else {
  for (const b of buckets ?? []) {
    console.log(`  • ${b.name.padEnd(30)} | public=${b.public} | created=${b.created_at}`)
  }
}

// attachments バケットの直接アクセス確認
console.log('\n── attachments バケット内のファイル (先頭 5 件) ──')
const { data: files, error: listErr } = await sb.storage.from('attachments').list('', { limit: 5 })
if (listErr) {
  console.log(`❌ list 失敗: ${listErr.message}`)
} else if (!files || files.length === 0) {
  console.log('  → 0 件 (バケット存在 or 空)')
} else {
  for (const f of files) {
    console.log(`  • ${f.name.padEnd(50)} | size=${f.metadata?.size ?? '?'} | created=${f.created_at}`)
  }
}

// upload 検証 (バケット存在確認の決定打)
console.log('\n── upload テスト (ダミー 1 byte) ──')
const testPath = `__bucket_check_${Date.now()}.txt`
const { error: upErr } = await sb.storage.from('attachments').upload(testPath, new Uint8Array([0x41]), { contentType: 'text/plain', upsert: false })
if (upErr) {
  console.log(`❌ upload 失敗: ${upErr.message}`)
  console.log('   → バケットが存在しない可能性が高い')
} else {
  console.log(`✓ upload 成功: ${testPath}`)
  // 後片付け
  await sb.storage.from('attachments').remove([testPath])
  console.log('  (削除済み)')
}
