/**
 * custom_records.data を TEXT → JSONB に変換するスクリプト
 * 実行: npx tsx scripts/apply-jsonb-migration.ts
 */
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  console.log('🔄 custom_records.data を JSONB に変換中...\n')

  // 現在の型を確認
  const before = await sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'custom_records' AND column_name = 'data'
  ` as { data_type: string }[]
  console.log('  変換前の型:', before[0]?.data_type)

  if (before[0]?.data_type === 'jsonb') {
    console.log('  ℹ️  既に JSONB 型です')
  } else {
    // DEFAULT を一旦削除してから型変換（text の DEFAULT は jsonb に自動キャストできないため）
    await sql`ALTER TABLE custom_records ALTER COLUMN data DROP DEFAULT`
    console.log('  ✅ DEFAULT 削除')
    await sql`ALTER TABLE custom_records ALTER COLUMN data TYPE JSONB USING data::jsonb`
    console.log('  ✅ ALTER COLUMN data TYPE JSONB 完了')
    await sql`ALTER TABLE custom_records ALTER COLUMN data SET DEFAULT '{}'::jsonb`
    console.log('  ✅ DEFAULT 復元（{}::jsonb）')
  }

  // GIN インデックス追加
  await sql`CREATE INDEX IF NOT EXISTS idx_custom_records_data_gin ON custom_records USING gin(data)`
  console.log('  ✅ GIN インデックス作成')

  // 確認
  const after = await sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'custom_records' AND column_name = 'data'
  ` as { data_type: string }[]
  console.log(`\n✅ 完了 — data カラムの型: ${after[0]?.data_type}`)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
