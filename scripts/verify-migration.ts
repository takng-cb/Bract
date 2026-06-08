/**
 * Phase 1 migration の適用状況を確認する read-only スクリプト。
 *   - activity_related_records / task_related_records / expense_related_records
 *     の件数を表示
 *   - activity_contacts テーブルが残っていないか確認
 *
 * 使い方:
 *   DATABASE_URL=<neon> npx tsx scripts/verify-migration.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }
const host = url.match(/@([^/]+)\//)?.[1] ?? '(unknown)'
const sql = neon(url)

async function main() {
  console.log(`📍 ${host}`)
  const a = await sql`SELECT count(*)::int AS c FROM activity_related_records`
  const t = await sql`SELECT count(*)::int AS c FROM task_related_records`
  const e = await sql`SELECT count(*)::int AS c FROM expense_related_records`
  const droppedAc = await sql`SELECT count(*)::int AS c FROM information_schema.tables
                              WHERE table_schema='public' AND table_name='activity_contacts'`
  // Phase 2: FK 列が削除されているか確認
  const fkRemaining = await sql`SELECT count(*)::int AS c FROM information_schema.columns
                                WHERE table_schema='public'
                                  AND table_name IN ('activities','tasks','expenses')
                                  AND column_name IN ('account_id','contact_id','opportunity_id','custom_record_id')`
  console.log(`  activity_related_records: ${a[0].c}`)
  console.log(`  task_related_records:     ${t[0].c}`)
  console.log(`  expense_related_records:  ${e[0].c}`)
  console.log(`  activity_contacts table:  ${droppedAc[0].c === 0 ? '✅ dropped' : '❌ still exists'}`)
  console.log(`  FK 残列数 (Phase 2):      ${fkRemaining[0].c} ${fkRemaining[0].c === 0 ? '✅' : '❌'}`)
}
main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
