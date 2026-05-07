/**
 * scripts/migrate-properties-to-custom.mjs
 *
 * properties テーブルのデータをカスタムオブジェクトシステムへ安全に移行する。
 *
 * 安全策：
 * - properties テーブルは読み取り専用（一切変更しない）
 * - custom_records への INSERT は同一 UUID で行う（relationship_values が壊れない）
 * - ON CONFLICT DO NOTHING で冪等実行可能（何度実行しても安全）
 * - 最後に件数を検証して不一致があれば警告を出す
 *
 * 実行方法：
 *   node scripts/migrate-properties-to-custom.mjs
 *   node scripts/migrate-properties-to-custom.mjs --dry-run  # DBに書き込まない
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const isDryRun = process.argv.includes('--dry-run')
if (isDryRun) console.log('🔍 DRY-RUN モード（DBへの書き込みは行いません）\n')

// ── 環境変数読み込み ──────────────────────────────────────
const env = readFileSync('.env.local', 'utf-8')
const getEnv = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1]?.trim()
const databaseUrl = getEnv('DATABASE_URL')
if (!databaseUrl) { console.error('❌ DATABASE_URL が .env.local に見つかりません'); process.exit(1) }

const sql = neon(databaseUrl)

// ── field_definitions の定義（properties の全カラムをマッピング） ──
const FIELD_DEFS = [
  // ─── 基本情報 ───
  { api_name: '__section_basic',    label: '基本情報',          field_type: 'section',   sort_order:   0 },
  { api_name: 'name',               label: '物件名 / 件名',     field_type: 'text',      sort_order:  10, is_required: true },
  { api_name: 'product_category',   label: 'カテゴリ',          field_type: 'select',    sort_order:  20, options: JSON.stringify(['real_estate', 'other']) },
  { api_name: 'property_type',      label: '物件種別',          field_type: 'select',    sort_order:  30, options: JSON.stringify(['土地・建物', '建物のみ', '土地のみ', 'その他']) },
  { api_name: 'transaction_type',   label: '取引種別',          field_type: 'select',    sort_order:  40, options: JSON.stringify(['売買', '賃貸', 'サービス提供', 'その他']) },
  { api_name: 'status',             label: 'ステータス',        field_type: 'select',    sort_order:  50, options: JSON.stringify(['募集中', '提案中', '交渉中', '成約', '管理中', '終了']) },
  { api_name: 'price',              label: '価格 / 賃料（円）', field_type: 'number',    sort_order:  60 },
  { api_name: 'address',            label: '所在地',            field_type: 'text',      sort_order:  70 },

  // ─── 取引先・担当者 ───
  { api_name: '__section_relations', label: '取引先・担当者', field_type: 'section', sort_order:  80 },
  { api_name: 'account_id',          label: '取引先 ID',      field_type: 'text',    sort_order:  90 },
  { api_name: 'contact_id',          label: '担当者 ID',      field_type: 'text',    sort_order: 100 },

  // ─── 司法書士情報 ───
  { api_name: '__section_scrivener',            label: '⚖️ 司法書士情報',    field_type: 'section', sort_order: 110 },
  { api_name: 'seller_scrivener_account_id',    label: '売り方 事務所 ID',  field_type: 'text',    sort_order: 120 },
  { api_name: 'seller_scrivener_contact_id',    label: '売り方 担当者 ID',  field_type: 'text',    sort_order: 130 },
  { api_name: 'buyer_scrivener_account_id',     label: '買い方 事務所 ID',  field_type: 'text',    sort_order: 140 },
  { api_name: 'buyer_scrivener_contact_id',     label: '買い方 担当者 ID',  field_type: 'text',    sort_order: 150 },

  // ─── 土地の登記（表題部） ───
  { api_name: '__section_land_header',  label: '🗺️ 土地の登記（表題部）',    field_type: 'section', sort_order: 160 },
  { api_name: 'land_fudosan_number',    label: '不動産番号',                  field_type: 'text',    sort_order: 170 },
  { api_name: 'land_chiban',            label: '地番',                        field_type: 'text',    sort_order: 180 },
  { api_name: 'chimoku',                label: '地目',                        field_type: 'text',    sort_order: 190 },
  { api_name: 'area',                   label: '地積（㎡）',                  field_type: 'number',  sort_order: 200 },
  { api_name: 'land_cause',             label: '原因及びその日付',            field_type: 'text',    sort_order: 210 },

  // ─── 土地の登記（権利部・甲区） ───
  { api_name: '__section_land_rights',      label: '🗺️ 土地の登記（権利部・甲区）', field_type: 'section', sort_order: 220 },
  { api_name: 'land_owner_name',            label: '現所有者名',                     field_type: 'text',    sort_order: 230 },
  { api_name: 'land_owner_address',         label: '所有者住所',                     field_type: 'text',    sort_order: 240 },
  { api_name: 'land_acquisition_reason',    label: '所有権取得原因',                 field_type: 'text',    sort_order: 250 },
  { api_name: 'land_acquisition_date',      label: '所有権取得日',                   field_type: 'date',    sort_order: 260 },
  { api_name: 'land_seizure',               label: '差押有無',                       field_type: 'boolean', sort_order: 270 },
  { api_name: 'land_seizure_release_date',  label: '差押解除日',                     field_type: 'date',    sort_order: 280 },

  // ─── 建物の登記（表題部） ───
  { api_name: '__section_building_header',        label: '🏠 建物の登記（表題部）', field_type: 'section', sort_order: 290 },
  { api_name: 'building_fudosan_number',          label: '不動産番号',               field_type: 'text',    sort_order: 300 },
  { api_name: 'building_location',                label: '所在',                     field_type: 'text',    sort_order: 310 },
  { api_name: 'building_kaoku_number',            label: '家屋番号',                 field_type: 'text',    sort_order: 320 },
  { api_name: 'building_shurui',                  label: '種類',                     field_type: 'text',    sort_order: 330 },
  { api_name: 'structure',                        label: '構造',                     field_type: 'text',    sort_order: 340 },
  { api_name: 'building_floor_area_1f',           label: '床面積・1階（㎡）',        field_type: 'number',  sort_order: 350 },
  { api_name: 'building_floor_area_2f',           label: '床面積・2階（㎡）',        field_type: 'number',  sort_order: 360 },
  { api_name: 'building_floor_area_3f',           label: '床面積・3階（㎡）',        field_type: 'number',  sort_order: 370 },
  { api_name: 'building_new_construction_date',   label: '新築年月日',               field_type: 'date',    sort_order: 380 },

  // ─── 建物の登記（甲区） ───
  { api_name: '__section_building_rights',      label: '🏠 建物の登記（甲区）', field_type: 'section', sort_order: 390 },
  { api_name: 'building_owner_name',            label: '現所有者名',             field_type: 'text',    sort_order: 400 },
  { api_name: 'building_owner_address',         label: '所有者住所',             field_type: 'text',    sort_order: 410 },
  { api_name: 'building_acquisition_reason',    label: '所有権取得原因',         field_type: 'text',    sort_order: 420 },
  { api_name: 'building_acquisition_date',      label: '所有権取得日',           field_type: 'date',    sort_order: 430 },
  { api_name: 'building_seizure',               label: '差押有無',               field_type: 'boolean', sort_order: 440 },
  { api_name: 'building_seizure_release_date',  label: '差押解除日',             field_type: 'date',    sort_order: 450 },

  // ─── 建物の登記（乙区） ───
  { api_name: '__section_building_lien',            label: '🏠 建物の登記（乙区）', field_type: 'section', sort_order: 460 },
  { api_name: 'building_lien_type',                 label: '登記種別',              field_type: 'text',    sort_order: 470 },
  { api_name: 'building_lien_holder',               label: '権利者名',              field_type: 'text',    sort_order: 480 },
  { api_name: 'building_debt_amount',               label: '債権額（円）',          field_type: 'number',  sort_order: 490 },
  { api_name: 'building_damage_rate',               label: '損害金率（%）',         field_type: 'number',  sort_order: 500 },
  { api_name: 'building_joint_collateral_number',   label: '共同担保目録番号',      field_type: 'text',    sort_order: 510 },

  // ─── 備考 ───
  { api_name: '__section_notes', label: '備考',  field_type: 'section',   sort_order: 520 },
  { api_name: 'description',     label: '備考',  field_type: 'textarea',  sort_order: 530 },
]

// ── メイン処理 ────────────────────────────────────────────
async function main() {
  console.log('📋 Step 1: object_definitions に properties を登録...')

  // 既存チェック
  const existingObj = await sql`
    SELECT id FROM object_definitions WHERE api_name = 'properties' LIMIT 1
  `

  let objectId
  if (existingObj.length > 0) {
    objectId = existingObj[0].id
    console.log(`  ℹ️  既存の object_definitions を使用: ${objectId}`)
  } else {
    if (!isDryRun) {
      const res = await sql`
        INSERT INTO object_definitions (api_name, label, label_plural, icon, is_builtin, nav_enabled, sort_order)
        VALUES ('properties', '物件', '物件一覧', '🏠', false, true, 10)
        RETURNING id
      `
      objectId = res[0].id
      console.log(`  ✅ object_definitions 作成: ${objectId}`)
    } else {
      objectId = '00000000-0000-0000-0000-000000000000'
      console.log(`  [DRY-RUN] object_definitions を作成予定`)
    }
  }

  // ── Step 2: field_definitions 作成 ──
  console.log('\n📋 Step 2: field_definitions を作成...')
  let createdFields = 0
  let skippedFields = 0

  for (const f of FIELD_DEFS) {
    const existing = await sql`
      SELECT id FROM field_definitions
      WHERE object_id = ${objectId} AND api_name = ${f.api_name}
      LIMIT 1
    `
    if (existing.length > 0) {
      skippedFields++
      continue
    }

    if (!isDryRun) {
      await sql`
        INSERT INTO field_definitions (
          object_id, api_name, label, field_type, options,
          is_required, is_builtin, is_visible, sort_order
        )
        VALUES (
          ${objectId},
          ${f.api_name},
          ${f.label},
          ${f.field_type},
          ${f.options ?? null},
          ${f.is_required ?? false},
          false,
          true,
          ${f.sort_order}
        )
      `
      createdFields++
    } else {
      console.log(`  [DRY-RUN] フィールド追加予定: ${f.api_name} (${f.field_type})`)
      createdFields++
    }
  }

  console.log(`  ✅ フィールド作成: ${createdFields}件 / スキップ（既存）: ${skippedFields}件`)

  // ── Step 3: properties → custom_records データ移行 ──
  console.log('\n📋 Step 3: properties テーブルのデータを custom_records へコピー...')

  const propRows = await sql`SELECT * FROM properties ORDER BY created_at`
  console.log(`  📊 properties テーブル: ${propRows.length}件`)

  let inserted = 0
  let updated  = 0
  let errors   = 0

  for (const p of propRows) {
    // properties の全カラムを JSON にシリアライズ
    const data = {}
    const SKIP_COLS = new Set(['id', 'created_at', 'updated_at', 'owner_id'])

    for (const [key, val] of Object.entries(p)) {
      if (SKIP_COLS.has(key)) continue
      if (val === null || val === undefined) continue
      // date 型は ISO 文字列 → YYYY-MM-DD に変換
      if (val instanceof Date) {
        data[key] = val.toISOString().split('T')[0]
      } else {
        data[key] = val
      }
    }

    // 既に custom_records に同 ID があるかチェック
    const existing = await sql`
      SELECT id FROM custom_records WHERE id = ${p.id} LIMIT 1
    `

    try {
      if (!isDryRun) {
        if (existing.length > 0) {
          // 既存レコードを properties の最新データで上書き更新
          await sql`
            UPDATE custom_records
            SET data = ${JSON.stringify(data)}, updated_at = ${p.updated_at}
            WHERE id = ${p.id}
          `
          updated++
        } else {
          await sql`
            INSERT INTO custom_records (id, object_id, data, owner_id, created_at, updated_at)
            VALUES (
              ${p.id},
              ${objectId},
              ${JSON.stringify(data)},
              ${p.owner_id ?? null},
              ${p.created_at},
              ${p.updated_at}
            )
          `
          inserted++
        }
      } else {
        if (existing.length > 0) {
          console.log(`  [DRY-RUN] 更新予定: ${p.id} (${data.name ?? '?'})`)
        } else {
          console.log(`  [DRY-RUN] 挿入予定: ${p.id} (${data.name ?? '?'})`)
        }
        inserted++
      }
      if ((inserted + updated) % 10 === 0) process.stdout.write('.')
    } catch (e) {
      errors++
      console.error(`\n  ❌ ID ${p.id} の処理失敗:`, e.message)
    }
  }

  if (inserted + updated > 0) console.log()
  console.log(`  ✅ 新規挿入: ${inserted}件 / 更新: ${updated}件 / エラー: ${errors}件`)

  // ── Step 4: 件数検証 ──
  console.log('\n📋 Step 4: 件数検証...')

  const propCount   = (await sql`SELECT COUNT(*)::int AS c FROM properties`)[0].c
  const customCount = (await sql`SELECT COUNT(*)::int AS c FROM custom_records WHERE object_id = ${objectId}`)[0].c

  console.log(`  properties  テーブル: ${propCount}件`)
  console.log(`  custom_records（物件）: ${customCount}件`)

  if (isDryRun) {
    console.log('\n✅ DRY-RUN 完了。実際に移行するには --dry-run を外して実行してください。')
  } else if (propCount === customCount) {
    console.log('\n✅ 件数一致！移行成功です。')
    console.log('   → 物件の閲覧: http://localhost:3000/objects/properties')
  } else {
    console.warn(`\n⚠️  件数不一致！properties=${propCount}, custom_records=${customCount}`)
    console.warn('   エラーが発生した可能性があります。ログを確認してください。')
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error('\n❌ 予期せぬエラー:', e)
  process.exit(1)
})
