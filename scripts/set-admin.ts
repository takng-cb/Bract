import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  await sql`UPDATE users SET role = 'admin' WHERE email = 't_noguchi@cactus-bridge.com'`
  const rows = await sql`SELECT email, role FROM users ORDER BY created_at`
  console.log('更新後:')
  rows.forEach((r) => console.log(`  ${r.email} → ${r.role}`))
}

main().catch(console.error)
