import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  const rows = await sql`SELECT id, email, role, created_at FROM users ORDER BY created_at`
  console.log('users テーブル:')
  console.log(JSON.stringify(rows, null, 2))
  console.log(`\n合計: ${rows.length} 件`)
}

main().catch(console.error)
