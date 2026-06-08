/**
 * real-estate Neon に auto-body の object_definitions / テーブルが
 * どれだけ残っているか確認するだけの read-only スクリプト。
 *
 * 実行:
 *   node scripts/inspect-re-leak.mjs
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const url = process.env.DATABASE_URL ?? ''
const host = url.match(/@([^/]+)\//)?.[1] ?? '(unknown)'
console.log(`接続先ホスト: ${host}\n`)

// 1. object_definitions に auto-body 系の行があるか
console.log('── object_definitions (auto-body 系) ──')
const rows = await sql`
  SELECT api_name, label_plural, icon, is_builtin, nav_enabled, sort_order
    FROM object_definitions
   WHERE api_name IN ('vehicles', 'parts', 'part_movements')
   ORDER BY sort_order
`
if (rows.length === 0) {
  console.log('  → 0 件 (クリーンです)')
} else {
  for (const r of rows) {
    console.log(`  • ${r.api_name.padEnd(16)} | label=${r.label_plural} | icon=${r.icon} | nav_enabled=${r.nav_enabled} | builtin=${r.is_builtin}`)
  }
}

// 2. 関連テーブルの存在
console.log('\n── テーブル存在確認 ──')
const tables = await sql`
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('vehicles', 'parts', 'part_movements')
   ORDER BY table_name
`
if (tables.length === 0) {
  console.log('  → 0 件 (テーブル無し)')
} else {
  for (const t of tables) {
    // 各テーブルの行数も確認 (tagged-template の制約に合わせて分岐)
    let n = '?'
    try {
      if (t.table_name === 'vehicles')        n = (await sql`SELECT COUNT(*)::int AS n FROM vehicles`)[0].n
      if (t.table_name === 'parts')           n = (await sql`SELECT COUNT(*)::int AS n FROM parts`)[0].n
      if (t.table_name === 'part_movements')  n = (await sql`SELECT COUNT(*)::int AS n FROM part_movements`)[0].n
    } catch (e) { n = `(err: ${e.message})` }
    console.log(`  • ${t.table_name.padEnd(16)} | rows=${n}`)
  }
}

// 3. 上記オブジェクトに紐づく field_definitions の行数
console.log('\n── 紐づく field_definitions ──')
const fields = await sql`
  SELECT od.api_name, COUNT(fd.id)::int AS n
    FROM object_definitions od
    LEFT JOIN field_definitions fd ON fd.object_id = od.id
   WHERE od.api_name IN ('vehicles', 'parts', 'part_movements')
   GROUP BY od.api_name
   ORDER BY od.api_name
`
if (fields.length === 0) {
  console.log('  → 0 件')
} else {
  for (const f of fields) {
    console.log(`  • ${f.api_name.padEnd(16)} | fields=${f.n}`)
  }
}
