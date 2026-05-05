import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'properties'
    ORDER BY ordinal_position
  `
  console.log('=== properties テーブルの実際のカラム ===')
  cols.forEach((c: any) => {
    console.log(
      c.column_name.padEnd(42),
      c.data_type.padEnd(22),
      c.is_nullable,
    )
  })
  console.log(`\n計 ${cols.length} カラム`)

  // テスト INSERT
  try {
    const result = await sql`
      INSERT INTO properties (product_category, name, property_type, transaction_type, status, land_seizure, building_seizure)
      VALUES ('real_estate', '__test__', 'その他', '売買', '募集中', false, false)
      RETURNING id
    `
    console.log('\n✅ テスト INSERT 成功:', result[0].id)
    await sql`DELETE FROM properties WHERE name = '__test__'`
    console.log('✅ テストデータ削除完了')
  } catch (e: any) {
    console.error('\n❌ テスト INSERT 失敗:', e.message)
  }
}

main().catch(console.error)
