/**
 * One-off script to apply a single SQL migration file to the configured DATABASE_URL.
 * Usage: npx tsx scripts/apply-migration.ts <relative-sql-path>
 */
import { config as loadEnv } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

loadEnv({ path: '.env.local' })
loadEnv()

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: tsx scripts/apply-migration.ts <relative-sql-path>')
    process.exit(1)
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set (check .env.local)')
    process.exit(1)
  }
  const sqlPath = resolve(process.cwd(), arg)
  const raw = readFileSync(sqlPath, 'utf8')
  const stripped = raw.replace(/--[^\n]*/g, '')
  const stmts = stripped.split(';').map((s) => s.trim()).filter((s) => s.length > 0)

  const sql = neon(url)
  console.log(`Applying ${arg} (${stmts.length} statement(s))...`)
  for (const s of stmts) {
    const head = s.replace(/\s+/g, ' ').slice(0, 100)
    console.log(`  → ${head}${s.length > 100 ? ' …' : ''}`)
    await sql.query(s)
  }
  console.log('Done.')
}

main().catch((e) => { console.error('Migration failed:', e.message); process.exit(1) })
