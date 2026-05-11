/**
 * 任意 DB の現状を軽量にスナップショットする read-only スクリプト。
 * マイグレーション適用前の事前検証 + ロールバック SQL 生成。
 *
 * 出力:
 *   ./backups/<host>/<timestamp>/
 *     - meta.json          : テーブル一覧 / 各テーブルの行数とカラム名
 *     - opportunities-rows.json : opportunities 全行（差し戻し用）
 *     - object_definitions-rows.json : 全行（後で追加される行の確認用）
 *
 * 実行:
 *   npx tsx scripts/snapshot-db.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL 未設定'); process.exit(1) }
const host = url.match(/@([^/]+)\//)?.[1] ?? 'unknown'
const hostShort = host.split('.')[0]
const sql = neon(url)
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const dir = join('backups', hostShort, ts)

async function main() {
  console.log(`📍 対象: ${host}`)
  console.log(`📁 出力先: ${dir}\n`)
  mkdirSync(dir, { recursive: true })

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `
  const tableList: string[] = tables.map((t) => t.table_name as string)
  console.log(`📋 テーブル数: ${tableList.length}`)

  const counts: Record<string, number> = {}
  const colsByTable: Record<string, string[]> = {}
  for (const t of tableList) {
    const c = await sql.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    counts[t] = c[0].n
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t}
      ORDER BY ordinal_position
    `
    colsByTable[t] = cols.map((x) => x.column_name as string)
  }

  // opportunities と object_definitions は全行ダンプ
  const oppRows = tableList.includes('opportunities')
    ? await sql`SELECT * FROM opportunities` : []
  const odRows = tableList.includes('object_definitions')
    ? await sql`SELECT * FROM object_definitions` : []

  writeFileSync(join(dir, 'meta.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    db_host: host,
    tables: tableList,
    row_counts: counts,
    columns: colsByTable,
  }, null, 2))
  writeFileSync(join(dir, 'opportunities-rows.json'), JSON.stringify(oppRows, null, 2))
  writeFileSync(join(dir, 'object_definitions-rows.json'), JSON.stringify(odRows, null, 2))

  console.log(`💾 dump 完了`)
  console.log(`   - opportunities: ${oppRows.length} 行`)
  console.log(`   - object_definitions: ${odRows.length} 行`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1) })
