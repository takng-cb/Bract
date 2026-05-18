/**
 * 既存の customer_vehicles の body_shape を新しい選択リストの値に更新する
 * ワンオフスクリプト。
 *
 * マッピングは plate_number ベース（seed-maintenance.ts で使われているテスト
 * 車両のキー）。手入力で増やしたレコードは触らない（plate に該当がなければ
 * スキップ）。
 *
 * 旧 → 新 のおおまかな対応:
 *   箱型 (軽自動車)        → 軽自動車
 *   箱型 (ハイエース等)     → バントラック
 *   ステーションワゴン (SUV) → SUV
 *   ステーションワゴン (ミニバン) → ミニバン
 *   トラック               → 平ボディトラック
 *
 * 使い方:
 *   DATABASE_URL=<...> tsx scripts/update-body-shapes.ts
 */
import { config as loadEnv } from 'dotenv'
import { neon } from '@neondatabase/serverless'

loadEnv({ path: '.env.local' })
loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = neon(url)

// plate_number → 新しい body_shape
const PLATE_TO_SHAPE: Record<string, string> = {
  '12-34': 'セダン',          // プリウス
  '23-45': '軽自動車',         // N-BOX
  '34-56': '軽自動車',         // ハスラー
  '45-67': 'SUV',             // CX-5
  '56-78': 'SUV',             // ハリアー
  '67-89': 'ミニバン',         // セレナ
  '78-90': '軽自動車',         // タント
  '89-01': 'セダン',          // インプレッサ
  '11-22': '平ボディトラック', // エルフ
  '22-33': 'バントラック',     // ハイエース
}

async function main() {
  console.log(`=== update-body-shapes ===`)
  console.log(`DB host: ${url!.match(/@([^./]*)/)?.[1] ?? '?'}\n`)

  let total = 0
  for (const [plate, shape] of Object.entries(PLATE_TO_SHAPE)) {
    const res = await sql.query(
      'UPDATE customer_vehicles SET body_shape = $1, updated_at = NOW() WHERE plate_number = $2',
      [shape, plate],
    )
    const count = (res as { rowCount?: number }).rowCount ?? 0
    console.log(`  ${plate.padEnd(8)} → ${shape.padEnd(20)} (${count} rows)`)
    total += count
  }
  console.log(`\nDone. ${total} row(s) updated.`)
}

main().catch((e) => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1) })
