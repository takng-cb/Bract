/**
 * auto-body マイグレーション (20260509000000_auto_body_vehicles.sql) を
 * real-estate Neon に適用する前のスナップショットを取る one-off スクリプト。
 *
 * 出力:
 *   ./backups/<timestamp>/
 *     - meta.json                : DB ホスト・実行日時・現状カラム一覧
 *     - opportunities-rows.json  : opportunities の全行を JSON 配列で保存
 *     - vehicles-rows.json       : vehicles テーブルが存在すればその全行（なければスキップ）
 *     - rollback.sql             : マイグレ後に問題が出た場合に追加カラム / 新規テーブルを取り消す SQL
 *
 * 実行:
 *   npx tsx scripts/backup-before-auto-body-migration.ts
 *
 * 安全策:
 *   - 読み取り専用クエリのみ。DB の状態は変更しない。
 *   - DATABASE_URL の接続先ホスト（資格情報マスク）を最初に表示し、
 *     誤った DB に対して走っていないかを目視確認できるようにする。
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL が .env.local に未設定です'); process.exit(1) }

// ホスト名だけ抽出（資格情報マスク）
const hostMatch = url.match(/@([^/]+)\//)
const host = hostMatch ? hostMatch[1] : '(unknown)'

const sql = neon(url)
const ts  = new Date().toISOString().replace(/[:.]/g, '-')
const dir = join('backups', ts)

async function main() {
  console.log(`📍 対象 Neon ホスト: ${host}`)
  console.log(`📁 出力先: ${dir}\n`)
  mkdirSync(dir, { recursive: true })

  // 1. 現状の opportunities カラム一覧
  console.log('🔍 opportunities の現状カラムを取得中...')
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities'
    ORDER BY ordinal_position
  `
  const colNames = cols.map((c) => c.column_name as string)
  const hasServiceType = colNames.includes('service_type')
  const hasVehicleId   = colNames.includes('vehicle_id')
  const hasPartsCost   = colNames.includes('parts_cost')
  console.log(`   現存カラム数: ${cols.length}`)
  console.log(`   service_type 存在: ${hasServiceType}`)
  console.log(`   vehicle_id   存在: ${hasVehicleId}`)
  console.log(`   parts_cost   存在: ${hasPartsCost}`)

  // 2. vehicles テーブルが既に存在するか
  const vehiclesExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'vehicles'
    ) AS exists
  `
  const hasVehiclesTable = vehiclesExists[0]?.exists as boolean
  console.log(`   vehicles テーブル存在: ${hasVehiclesTable}\n`)

  // 3. opportunities の全行ダンプ
  console.log('💾 opportunities の全行をダンプ中...')
  const oppRows = await sql`SELECT * FROM opportunities`
  console.log(`   ${oppRows.length} 行取得\n`)
  writeFileSync(join(dir, 'opportunities-rows.json'), JSON.stringify(oppRows, null, 2))

  // 4. vehicles の全行ダンプ（あれば）
  if (hasVehiclesTable) {
    console.log('💾 vehicles の全行をダンプ中...')
    const vRows = await sql`SELECT * FROM vehicles`
    console.log(`   ${vRows.length} 行取得\n`)
    writeFileSync(join(dir, 'vehicles-rows.json'), JSON.stringify(vRows, null, 2))
  }

  // 5. メタ情報
  const meta = {
    timestamp: new Date().toISOString(),
    db_host:   host,
    opportunities_columns: cols,
    opportunities_row_count: oppRows.length,
    has_service_type: hasServiceType,
    has_vehicle_id:   hasVehicleId,
    has_parts_cost:   hasPartsCost,
    has_vehicles_table: hasVehiclesTable,
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2))

  // 6. ロールバック SQL を生成（マイグレ適用後にやり直したい場合に使う）
  const rollback = [
    '-- 自動生成: auto-body マイグレーションのロールバック',
    `-- バックアップ取得時点: ${meta.timestamp}`,
    `-- DB ホスト: ${host}`,
    '--',
    '-- マイグレ適用後にこの SQL を流せば、追加された 3 カラムと vehicles テーブルを取り消せる。',
    '-- 既存データは opportunities-rows.json で復元可能（JSON → INSERT は手動）。',
    '',
    'BEGIN;',
    !hasServiceType ? 'ALTER TABLE opportunities DROP COLUMN IF EXISTS service_type;' : '-- service_type は元から存在したため DROP しない',
    !hasVehicleId   ? 'ALTER TABLE opportunities DROP COLUMN IF EXISTS vehicle_id;'   : '-- vehicle_id は元から存在したため DROP しない',
    !hasPartsCost   ? 'ALTER TABLE opportunities DROP COLUMN IF EXISTS parts_cost;'   : '-- parts_cost は元から存在したため DROP しない',
    !hasVehiclesTable ? 'DROP TABLE IF EXISTS vehicles;' : '-- vehicles は元から存在したため DROP しない',
    'COMMIT;',
    '',
  ].join('\n')
  writeFileSync(join(dir, 'rollback.sql'), rollback)

  console.log('✅ バックアップ完了')
  console.log(`   ${dir}/meta.json`)
  console.log(`   ${dir}/opportunities-rows.json`)
  if (hasVehiclesTable) console.log(`   ${dir}/vehicles-rows.json`)
  console.log(`   ${dir}/rollback.sql`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1) })
