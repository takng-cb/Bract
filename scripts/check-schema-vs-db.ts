/**
 * src/lib/schema.ts で宣言された全テーブル/カラムが
 * 接続先 DB に実在するかをチェックする read-only スクリプト。
 *
 * Drizzle のスキーマオブジェクトを import し、各 pgTable の name と
 * カラムの sqlName を取り出して information_schema と突き合わせる。
 *
 * 期待: 各テーブルについて
 *   - schema にあるが DB に無いカラム = ✗（ページが落ちる可能性）
 *   - DB にあるが schema に無いカラム = ⚠（古い列 / マイグレ漏れ）
 *
 * 実行:
 *   npx tsx scripts/check-schema-vs-db.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'
import { getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from '../src/lib/schema'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL 未設定'); process.exit(1) }
const host = url.match(/@([^/]+)\//)?.[1] ?? '(unknown)'
const sql = neon(url)

type Mismatch = { table: string; schemaOnly: string[]; dbOnly: string[]; tableMissing: boolean }

async function main() {
  console.log(`📍 対象 Neon ホスト: ${host}\n`)

  // 1. schema.ts から全テーブルを抽出
  const tables: { name: string; cols: string[] }[] = []
  for (const key of Object.keys(schema)) {
    const val = (schema as Record<string, unknown>)[key]
    // pgTable で作られたものは getTableConfig が通る
    try {
      const cfg = getTableConfig(val as never)
      tables.push({ name: cfg.name, cols: cfg.columns.map((c) => c.name) })
    } catch {
      // relations 等は skip
    }
  }
  tables.sort((a, b) => a.name.localeCompare(b.name))
  console.log(`📋 schema.ts のテーブル数: ${tables.length}\n`)

  // 2. 各テーブルについて DB の現状カラムを取得し比較
  const mismatches: Mismatch[] = []
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${t.name}
    `
    if (cols.length === 0) {
      // テーブル自体が存在しない
      mismatches.push({ table: t.name, schemaOnly: t.cols, dbOnly: [], tableMissing: true })
      continue
    }
    const dbCols = new Set(cols.map((c) => c.column_name as string))
    const schemaCols = new Set(t.cols)
    const schemaOnly = t.cols.filter((c) => !dbCols.has(c))
    const dbOnly = [...dbCols].filter((c) => !schemaCols.has(c))
    if (schemaOnly.length > 0 || dbOnly.length > 0) {
      mismatches.push({ table: t.name, schemaOnly, dbOnly, tableMissing: false })
    }
  }

  // 3. レポート
  if (mismatches.length === 0) {
    console.log('✅ すべてのテーブルでスキーマと DB が一致しています')
    return
  }

  console.log(`⚠ 不一致が見つかったテーブル: ${mismatches.length} 個\n`)
  for (const m of mismatches) {
    if (m.tableMissing) {
      console.log(`✗ ${m.table}: テーブル自体が DB に存在しない (schema は ${m.schemaOnly.length} カラム宣言)`)
      continue
    }
    console.log(`▼ ${m.table}`)
    if (m.schemaOnly.length > 0) {
      console.log(`   ✗ schema にあるが DB に無い: ${m.schemaOnly.join(', ')}`)
    }
    if (m.dbOnly.length > 0) {
      console.log(`   ⚠ DB にあるが schema に無い: ${m.dbOnly.join(', ')}`)
    }
  }

  // schemaOnly が一つでもあれば exit 1（重大）
  const critical = mismatches.some((m) => m.tableMissing || m.schemaOnly.length > 0)
  if (critical) {
    console.log('\n❌ 重大: schemaOnly があるとページの SELECT がエラーで落ちます')
    process.exit(1)
  } else {
    console.log('\n✓ schemaOnly はなし — ページは落ちないが DB に古い列が残っている可能性あり')
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1) })
