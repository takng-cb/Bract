/**
 * real-estate Neon (ep-soft-poetry) に残った auto-body 関連の
 * object_definitions / 空テーブルを一括削除する。
 *
 * 事前確認: scripts/inspect-re-leak.mjs で 0 行であることを確認済み。
 *
 * 実行:
 *   node scripts/cleanup-re-leak.mjs
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const url = process.env.DATABASE_URL ?? ''
const host = url.match(/@([^/]+)\//)?.[1] ?? '(unknown)'
console.log(`接続先ホスト: ${host}`)

// ガード: real-estate Neon でなければ中断
if (!host.includes('ep-soft-poetry')) {
  console.error('❌ このスクリプトは real-estate Neon (ep-soft-poetry) 専用です。中断。')
  process.exit(1)
}
console.log()

// 1. field_definitions (object_id 経由) — 0 件のはずだが念のため
console.log('1. field_definitions を削除 (該当 object_definitions 配下)')
const delFields = await sql`
  DELETE FROM field_definitions
   WHERE object_id IN (
     SELECT id FROM object_definitions
      WHERE api_name IN ('vehicles', 'parts', 'part_movements')
   )
  RETURNING id
`
console.log(`   削除: ${delFields.length} 件`)

// 2. object_definitions
console.log('2. object_definitions を削除')
const delObjs = await sql`
  DELETE FROM object_definitions
   WHERE api_name IN ('vehicles', 'parts', 'part_movements')
  RETURNING api_name
`
console.log(`   削除: ${delObjs.length} 件 (${delObjs.map((r) => r.api_name).join(', ')})`)

// 3. 空テーブルを DROP
console.log('3. テーブルを DROP')
await sql`DROP TABLE IF EXISTS part_movements CASCADE`
console.log('   ✓ part_movements')
await sql`DROP TABLE IF EXISTS parts CASCADE`
console.log('   ✓ parts')
await sql`DROP TABLE IF EXISTS vehicles CASCADE`
console.log('   ✓ vehicles')

// 4. 検証
console.log('\n── 削除後の状態 ──')
const remain = await sql`
  SELECT api_name FROM object_definitions
   WHERE api_name IN ('vehicles', 'parts', 'part_movements')
`
console.log(`残存 object_definitions: ${remain.length} 件`)
const remainTables = await sql`
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('vehicles', 'parts', 'part_movements')
`
console.log(`残存テーブル: ${remainTables.length} 件`)

console.log('\n✅ クリーンアップ完了')
