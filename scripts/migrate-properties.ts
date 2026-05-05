/**
 * properties テーブルの列追加・削除を直接 SQL で適用するスクリプト
 * 実行: npx tsx scripts/migrate-properties.ts
 */
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  console.log('🔄 properties テーブルのスキーマ変更を適用中...\n')

  // ── 旧列を削除 ──────────────────────────────────────────────
  console.log('【旧列 削除】')
  try { await sql`ALTER TABLE properties DROP COLUMN IF EXISTS floor`; console.log('  ✅ DROP floor') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties DROP COLUMN IF EXISTS total_floors`; console.log('  ✅ DROP total_floors') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties DROP COLUMN IF EXISTS built_year`; console.log('  ✅ DROP built_year') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties DROP COLUMN IF EXISTS rights_status`; console.log('  ✅ DROP rights_status') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties DROP COLUMN IF EXISTS building_floor_area`; console.log('  ✅ DROP building_floor_area') } catch(e:any) { console.log('  ⚠️ ', e.message) }

  // ── 新列を追加 ──────────────────────────────────────────────
  console.log('\n【新列 追加】')

  // 土地 表題部
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_fudosan_number TEXT`; console.log('  ✅ land_fudosan_number') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_cause TEXT`; console.log('  ✅ land_cause') } catch(e:any) { console.log('  ⚠️ ', e.message) }

  // 土地 甲区
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_owner_name TEXT`; console.log('  ✅ land_owner_name') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_owner_address TEXT`; console.log('  ✅ land_owner_address') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_acquisition_reason TEXT`; console.log('  ✅ land_acquisition_reason') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_acquisition_date DATE`; console.log('  ✅ land_acquisition_date') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_seizure BOOLEAN DEFAULT FALSE`; console.log('  ✅ land_seizure') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_seizure_release_date DATE`; console.log('  ✅ land_seizure_release_date') } catch(e:any) { console.log('  ⚠️ ', e.message) }

  // 建物 表題部
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_fudosan_number TEXT`; console.log('  ✅ building_fudosan_number') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_location TEXT`; console.log('  ✅ building_location') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_floor_area_1f NUMERIC`; console.log('  ✅ building_floor_area_1f') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_floor_area_2f NUMERIC`; console.log('  ✅ building_floor_area_2f') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_floor_area_3f NUMERIC`; console.log('  ✅ building_floor_area_3f') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_new_construction_date DATE`; console.log('  ✅ building_new_construction_date') } catch(e:any) { console.log('  ⚠️ ', e.message) }

  // 建物 甲区
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_owner_name TEXT`; console.log('  ✅ building_owner_name') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_owner_address TEXT`; console.log('  ✅ building_owner_address') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_acquisition_reason TEXT`; console.log('  ✅ building_acquisition_reason') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_acquisition_date DATE`; console.log('  ✅ building_acquisition_date') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_seizure BOOLEAN DEFAULT FALSE`; console.log('  ✅ building_seizure') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_seizure_release_date DATE`; console.log('  ✅ building_seizure_release_date') } catch(e:any) { console.log('  ⚠️ ', e.message) }

  // 建物 乙区
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_lien_type TEXT`; console.log('  ✅ building_lien_type') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_lien_holder TEXT`; console.log('  ✅ building_lien_holder') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_debt_amount BIGINT`; console.log('  ✅ building_debt_amount') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_damage_rate NUMERIC`; console.log('  ✅ building_damage_rate') } catch(e:any) { console.log('  ⚠️ ', e.message) }
  try { await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_joint_collateral_number TEXT`; console.log('  ✅ building_joint_collateral_number') } catch(e:any) { console.log('  ⚠️ ', e.message) }

  // 最終確認
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'properties' ORDER BY ordinal_position
  `
  console.log(`\n✅ 完了 — properties テーブル: 計 ${cols.length} カラム`)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
