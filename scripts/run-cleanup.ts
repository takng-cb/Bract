/**
 * 任意の SQL ファイルを単一 Postgres セッションで実行する汎用スクリプト。
 *
 * 使い方:
 *   npx tsx scripts/run-cleanup.ts <sql-file>
 *
 * 環境変数:
 *   DATABASE_URL: 接続先 (.env.local から読む)
 *
 * 注意:
 *   - cleanup-auto-body-test-data.sql のように TEMP TABLE / BEGIN..COMMIT を含む
 *     multi-statement SQL のために Pool (WebSocket) を使う。
 *     HTTP モード (neon()) では session が共有されないので TEMP TABLE が機能しない。
 *   - 結果は最後の SELECT の出力を表示。
 */
import { config as loadEnv } from 'dotenv'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Node.js 環境では WebSocket コンストラクタを設定する必要がある
neonConfig.webSocketConstructor = ws

loadEnv({ path: '.env.local' })

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: tsx scripts/run-cleanup.ts <sql-file>')
    process.exit(1)
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set (check .env.local)')
    process.exit(1)
  }

  const sqlPath = resolve(process.cwd(), arg)
  const sqlText = readFileSync(sqlPath, 'utf8')

  // 接続先ホスト名を見えるところに出してから実行（誤接続防止）
  const host = new URL(url).hostname
  console.log(`📍 接続先 Neon: ${host}`)
  console.log(`📄 SQL ファイル: ${arg}`)
  console.log()

  const pool = new Pool({ connectionString: url })
  const client = await pool.connect()
  try {
    console.log('🔄 実行中...')
    // multi-statement / TEMP TABLE / BEGIN..COMMIT すべてを単一クエリで送る。
    // pg は ';' 区切りの multi-statement を順次実行し、最後の結果セットを返す。
    const result = await client.query(sqlText)

    console.log('✅ 実行完了')
    console.log()

    // pg は multi-statement の場合 result が単一オブジェクト or 配列で返るので両対応
    const results = Array.isArray(result) ? result : [result]
    let summaryShown = false
    for (const r of results) {
      if (r.rows && r.rows.length > 0) {
        // 件数サマリーらしき結果を見つけたら表示
        const cols = Object.keys(r.rows[0])
        if (cols.includes('records') || cols.includes('remaining') || cols.includes('display') || cols.includes('table_name')) {
          if (!summaryShown) {
            console.log('=== 結果サマリー ===')
            summaryShown = true
          }
          console.table(r.rows)
        }
      }
    }

    if (!summaryShown) {
      // 結果が見つからない場合は raw を出す
      console.log('結果:', JSON.stringify(result, null, 2).slice(0, 2000))
    }
  } catch (e) {
    console.error('❌ 実行失敗:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
