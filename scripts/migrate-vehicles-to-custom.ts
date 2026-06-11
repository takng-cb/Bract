/**
 * vehicles テーブルの既存データを book_records にミラーする一度きりの移行スクリプト。
 *
 * 想定:
 *   - auto-body Neon でのみ実行
 *   - migrate-properties-to-custom.mjs と同じ思想（同一 UUID で挿入）
 *   - 冪等（ON CONFLICT DO NOTHING / UPDATE）
 *
 * 通常の vehicle CRUD は src/industries/auto-body/actions/vehicles.ts で
 * 自動同期されるため、このスクリプトは初回 deploy 時の backfill のみで使う。
 *
 * 実行: npx tsx scripts/migrate-vehicles-to-custom.ts
 *       npx tsx scripts/migrate-vehicles-to-custom.ts --dry-run
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const isDryRun = process.argv.includes('--dry-run')
if (isDryRun) console.log('🔍 DRY-RUN モード（DB へ書き込みません）\n')

const sql = neon(process.env.DATABASE_URL!)

function vehicleLabel(v: { maker: string; model: string; year: number | null; license_plate: string | null }): string {
  return [
    `${v.maker} ${v.model}`,
    v.year ? `${v.year}年式` : null,
    v.license_plate,
  ].filter(Boolean).join(' / ')
}

async function main() {
  // 1. book_definitions に vehicles 行が存在するか確認
  const objs = await sql`SELECT id FROM book_definitions WHERE api_name = 'vehicles' LIMIT 1`
  if (objs.length === 0) {
    console.error('❌ book_definitions に vehicles 行がありません。')
    console.error('   先に scripts/seed-auto-body.ts を実行してマスタを投入してください。')
    process.exit(1)
  }
  const objectId = objs[0].id as string
  console.log(`✓ book_definitions[vehicles] = ${objectId}`)

  // 2. vehicles テーブルから全件取得
  const allVehicles = await sql`
    SELECT id, maker, model, year, mileage, color, license_plate, vin, status, owner_id
    FROM vehicles
  ` as Array<{
    id: string; maker: string; model: string; year: number | null; mileage: number | null;
    color: string | null; license_plate: string | null; vin: string | null; status: string;
    owner_id: string | null
  }>
  console.log(`\n📋 vehicles テーブル: ${allVehicles.length} 件`)

  // 3. book_records へ INSERT or UPDATE（同一 UUID）
  let inserted = 0, updated = 0
  const skipped = 0

  for (const v of allVehicles) {
    const data = {
      name:          vehicleLabel(v),
      maker:         v.maker,
      model:         v.model,
      year:          v.year,
      mileage:       v.mileage,
      color:         v.color,
      license_plate: v.license_plate,
      vin:           v.vin,
      status:        v.status,
    }

    const exists = await sql`SELECT id FROM book_records WHERE id = ${v.id} LIMIT 1`

    if (exists.length > 0) {
      if (!isDryRun) {
        await sql`
          UPDATE book_records
          SET data = ${JSON.stringify(data)}::jsonb,
              owner_id = ${v.owner_id},
              updated_at = now()
          WHERE id = ${v.id}
        `
      }
      updated++
    } else {
      if (!isDryRun) {
        await sql`
          INSERT INTO book_records (id, object_id, data, owner_id)
          VALUES (${v.id}, ${objectId}, ${JSON.stringify(data)}::jsonb, ${v.owner_id})
        `
      }
      inserted++
    }
  }

  console.log(`\n結果:`)
  console.log(`  inserted: ${inserted}`)
  console.log(`  updated:  ${updated}`)
  console.log(`  skipped:  ${skipped}`)

  // 4. 件数チェック
  const vCount = (await sql`SELECT count(*)::int AS c FROM vehicles`)[0].c
  const crCount = (await sql`SELECT count(*)::int AS c FROM book_records WHERE object_id = ${objectId}`)[0].c
  console.log(`\n件数検証:`)
  console.log(`  vehicles テーブル        : ${vCount}`)
  console.log(`  book_records[vehicles] : ${crCount}`)
  if (vCount !== crCount) {
    console.warn(`  ⚠️ 件数不一致。`)
  } else {
    console.log(`  ✅ 件数一致`)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1) })
