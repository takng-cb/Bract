/**
 * properties テーブルの列追加・削除を直接 SQL で適用するスクリプト
 * 実行: npx tsx scripts/migrate-properties.ts
 */
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('🔄 properties テーブルのスキーマ変更を適用中...')

  // 1. 旧列を削除
  const dropCols = [
    'floor',
    'total_floors',
    'built_year',
    'rights_status',
    'building_floor_area',
  ]

  const dropStmts: Record<string, string> = {
    floor:               'ALTER TABLE properties DROP COLUMN IF EXISTS floor',
    total_floors:        'ALTER TABLE properties DROP COLUMN IF EXISTS total_floors',
    built_year:          'ALTER TABLE properties DROP COLUMN IF EXISTS built_year',
    rights_status:       'ALTER TABLE properties DROP COLUMN IF EXISTS rights_status',
    building_floor_area: 'ALTER TABLE properties DROP COLUMN IF EXISTS building_floor_area',
  }

  for (const [col, stmt] of Object.entries(dropStmts)) {
    try {
      await sql.unsafe(stmt)
      console.log(`  ✅ DROP COLUMN ${col}`)
    } catch (e) {
      console.log(`  ⚠️  DROP COLUMN ${col}: ${(e as Error).message}`)
    }
  }

  // 2. 新列を追加（既存なら SKIP）
  const addCols: string[] = [
    // 土地 表題部
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_fudosan_number TEXT',
    // address は既存
    // land_chiban は既存
    // chimoku は既存
    // area は既存
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_cause TEXT',
    // 土地 甲区
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_owner_name TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_owner_address TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_acquisition_reason TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_acquisition_date DATE',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_seizure BOOLEAN DEFAULT FALSE',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_seizure_release_date DATE',
    // 建物 表題部
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_fudosan_number TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_location TEXT',
    // building_kaoku_number は既存
    // building_shurui は既存
    // structure は既存
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_floor_area_1f NUMERIC',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_floor_area_2f NUMERIC',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_floor_area_3f NUMERIC',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_new_construction_date DATE',
    // 建物 甲区
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_owner_name TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_owner_address TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_acquisition_reason TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_acquisition_date DATE',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_seizure BOOLEAN DEFAULT FALSE',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_seizure_release_date DATE',
    // 建物 乙区
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_lien_type TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_lien_holder TEXT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_debt_amount BIGINT',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_damage_rate NUMERIC',
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_joint_collateral_number TEXT',
  ]

  for (const stmt of addCols) {
    try {
      await sql.unsafe(stmt)
      const col = stmt.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] ?? stmt
      console.log(`  ✅ ${col}`)
    } catch (e) {
      console.log(`  ⚠️  ${stmt}: ${(e as Error).message}`)
    }
  }

  console.log('\n🎉 完了しました')
}

main().catch((e) => {
  console.error('❌ エラー:', e)
  process.exit(1)
})
