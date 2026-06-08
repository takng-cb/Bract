/**
 * dev 環境用：不動産・板金・人材の確認用テストデータ投入＋モジュール有効化
 *
 * 実行: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-dev-industries.ts
 *
 * 安全策（最重要）：
 *  - DATABASE_URL のホストが dev（autumn-king）でなければ **即 abort**。
 *  - 本番 Neon（ep-soft-poetry / ep-young-meadow / ep-proud-band）には絶対に書き込まない。
 *  - 再実行可能：先に '【DEV-SEED】' 行を全削除してから投入する。
 *  - dev に欠けている properties テーブル（real-estate overlay）を full DDL で作成する。
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql as dsql, like } from 'drizzle-orm'
import { pgTable, uuid, text, numeric } from 'drizzle-orm/pg-core'
import * as schema from '../src/lib/schema'

const url = process.env.DATABASE_URL ?? ''
const PROD_HOSTS = ['ep-soft-poetry', 'ep-young-meadow', 'ep-proud-band']
if (!url.includes('autumn-king')) { console.error('🛑 ABORT: DATABASE_URL が dev(autumn-king) ではありません。'); process.exit(1) }
if (PROD_HOSTS.some((h) => url.includes(h))) { console.error('🛑 ABORT: 本番 Neon を検出。'); process.exit(1) }

const sqlc = neon(url)
const db = drizzle(sqlc, { schema })

// properties（real-estate overlay。'@/' alias 回避のため投入列だけ再宣言）
const properties = pgTable('properties', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),
  product_category: text('product_category').notNull().default('real_estate'),
  property_type:    text('property_type').notNull().default('その他'),
  transaction_type: text('transaction_type').notNull().default('売買'),
  status:           text('status').notNull().default('募集中'),
  price:            numeric('price'),
  address:          text('address'),
  area:             numeric('area'),
  account_id:       uuid('account_id'),
  description:      text('description'),
})

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }

const MARKER = '【DEV-SEED】'
const FAM = ['田中', '山田', '鈴木', '佐藤', '高橋', '伊藤', '渡辺', '中村', '小林', '加藤', '吉田', '松本', '井上', '木村', '林', '斎藤', '清水', '山口', '池田', '橋本']
const GIV = ['健太', '美咲', '大輔', '洋子', '拓也', '由美', '誠', '幸子', '雄大', '明日香', '翔太', '真由美', '浩二', '恵子', '啓介', '智子', '和也', '優子', '達也', '裕美']
const KANA = ['タナカ', 'ヤマダ', 'スズキ', 'サトウ', 'タカハシ', 'イトウ', 'ワタナベ', 'ナカムラ', 'コバヤシ', 'カトウ']
const PREF = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '宮城県', '広島県', '京都府', '兵庫県']
const WARD = ['千代田区', '中央区', '港区', '渋谷区', '新宿区', '北区', '中区', '西区', '東区', '南区']

// dev に欠けている properties テーブルを現行スキーマ準拠の full DDL で作成（冪等）
async function ensurePropertiesTable() {
  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS properties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_category text NOT NULL DEFAULT 'real_estate',
      name text NOT NULL,
      property_type text NOT NULL DEFAULT 'その他',
      transaction_type text NOT NULL DEFAULT '売買',
      status text NOT NULL DEFAULT '募集中',
      price numeric,
      account_id uuid,
      contact_id uuid,
      seller_scrivener_account_id uuid,
      seller_scrivener_contact_id uuid,
      buyer_scrivener_account_id uuid,
      buyer_scrivener_contact_id uuid,
      land_fudosan_number text,
      address text,
      land_chiban text,
      chimoku text,
      area numeric,
      land_cause text,
      land_owner_name text,
      land_owner_address text,
      land_acquisition_reason text,
      land_acquisition_date date,
      land_seizure boolean DEFAULT false,
      land_seizure_release_date date,
      building_fudosan_number text,
      building_location text,
      building_kaoku_number text,
      building_shurui text,
      structure text,
      building_floor_area_1f numeric,
      building_floor_area_2f numeric,
      building_floor_area_3f numeric,
      building_new_construction_date date,
      building_owner_name text,
      building_owner_address text,
      building_acquisition_reason text,
      building_acquisition_date date,
      building_seizure boolean DEFAULT false,
      building_seizure_release_date date,
      building_lien_type text,
      building_lien_holder text,
      building_debt_amount bigint,
      building_damage_rate numeric,
      building_joint_collateral_number text,
      description text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`)
  console.log('  ✅ properties テーブル ensure（full DDL / IF NOT EXISTS）')
}

// 再実行用：既存 DEV-SEED 行を FK 安全な順で削除
async function cleanPrevious() {
  await db.delete(properties).where(like(properties.description, `${MARKER}%`))
  await db.delete(schema.parts).where(like(schema.parts.description, `${MARKER}%`))
  await db.delete(schema.staff).where(like(schema.staff.notes, `${MARKER}%`))
  await db.delete(schema.vehicles).where(like(schema.vehicles.description, `${MARKER}%`))
  await db.delete(schema.contacts).where(like(schema.contacts.description, `${MARKER}%`))
  await db.delete(schema.accounts).where(like(schema.accounts.description, `${MARKER}%`))
  console.log('  🧹 既存 DEV-SEED 行を削除（再実行のため）')
}

async function main() {
  console.log('🌱 dev(autumn-king) に確認用データを投入します')
  await ensurePropertiesTable()
  await cleanPrevious()

  // 取引先 25
  const accVals = Array.from({ length: 25 }, (_, i) => {
    const isSupplier = i % 5 === 0
    const ind = isSupplier ? pick(['部品商社', '人材紹介', '司法書士'])
      : pick(['不動産', '自動車整備', '製造業', '小売業', '建設業', 'IT・ソフトウェア'])
    return {
      name:         `${pick(['株式会社', '合同会社', '有限会社'])}${pick(['サンプル', 'テスト', 'みらい', 'あおぞら', 'さくら', 'ひまわり', 'つばさ', 'こもれび', 'やまと', 'なごみ'])}${pick(['商事', '工業', '不動産', 'モータース', 'パーツ', 'サービス', 'ホーム', 'エステート', '自動車', '物産'])}${i + 1}`,
      account_role: isSupplier ? 'supplier' : (i % 7 === 0 ? 'both' : 'client'),
      industry:     ind,
      type:         pick(['顧客', '見込み客', 'パートナー']),
      phone:        `0${rand(3, 9)}-${rand(1000, 9999)}-${rand(1000, 9999)}`,
      address:      `${pick(PREF)}${pick(WARD)}${rand(1, 5)}-${rand(1, 20)}-${rand(1, 10)}`,
      status:       'active',
      description:  `${MARKER} 確認用取引先 #${i + 1}（${ind}）`,
    }
  })
  const accRows = await db.insert(schema.accounts).values(accVals).returning({ id: schema.accounts.id, role: schema.accounts.account_role })
  const accIds = accRows.map((r) => r.id)
  const clientIds = accRows.filter((r) => r.role !== 'supplier').map((r) => r.id)
  const supplierIds = accRows.filter((r) => r.role === 'supplier' || r.role === 'both').map((r) => r.id)
  console.log(`  ✅ 取引先 ${accIds.length}`)

  // 人物 20
  const conVals = Array.from({ length: 20 }, (_, i) => ({
    account_id:   accIds[i % accIds.length], contact_type: 'business',
    full_name:    `${FAM[i % FAM.length]} ${GIV[i % GIV.length]}`,
    email:        `dev_contact${i + 1}@example.co.jp`,
    phone:        `090-${rand(1000, 9999)}-${rand(1000, 9999)}`,
    title:        pick(['代表取締役', '営業部長', '購買担当', '総務課長', '担当']),
    description:  `${MARKER} 確認用担当者 #${i + 1}`,
  }))
  await db.insert(schema.contacts).values(conVals)
  console.log(`  ✅ 人物 ${conVals.length}`)

  // 物件 20
  const PNAME = ['アーバン', 'グランド', 'ロイヤル', 'セントラル', 'プレミアム', 'パーク', 'タワー', 'ガーデン', 'コート', 'ヒルズ']
  const PAREA = ['渋谷', '新宿', '梅田', '心斎橋', '栄', '博多', '札幌', '仙台', '広島', '京都']
  const propVals = Array.from({ length: 20 }, (_, i) => ({
    name:             `${pick(PNAME)}${pick(PAREA)} ${pick(['101', '203', 'A棟', 'B棟', '1号地', '2号地'])}`,
    product_category: 'real_estate',
    property_type:    pick(['マンション', '戸建て', '土地', 'ビル', '店舗', '倉庫']),
    transaction_type: i % 3 === 0 ? '賃貸' : '売買',
    status:           pick(['募集中', '交渉中', '成約', '管理中']),
    price:            String(rand(800, 12000) * 10000),
    address:          `${pick(PREF)}${pick(WARD)}${rand(1, 9)}-${rand(1, 30)}`,
    area:             String(rand(40, 300)),
    account_id:       clientIds[i % clientIds.length],
    description:      `${MARKER} 確認用物件 #${i + 1}`,
  }))
  await db.insert(properties).values(propVals)
  console.log(`  ✅ 物件 ${propVals.length}`)

  // 車両 20
  const MAKERS = ['トヨタ', 'ホンダ', '日産', 'マツダ', 'スバル', 'スズキ', 'ダイハツ', 'レクサス', '三菱', 'いすゞ']
  const MODELS = ['プリウス', 'フィット', 'ノート', 'デミオ', 'インプレッサ', 'ワゴンR', 'タント', 'アクア', 'ヴェゼル', 'セレナ']
  const vehVals = Array.from({ length: 20 }, (_, i) => ({
    maker:          MAKERS[i % MAKERS.length], model: MODELS[i % MODELS.length],
    year:           rand(2008, 2024), mileage: rand(5, 180) * 1000,
    color:          pick(['ホワイト', 'ブラック', 'シルバー', 'レッド', 'ブルー', 'グレー']),
    license_plate:  `${pick(['品川', '練馬', '大阪', '名古屋', '福岡'])}${rand(300, 599)} ${pick(['あ', 'か', 'さ', 'た'])} ${rand(10, 99)}-${rand(10, 99)}`,
    vin:            `DEV-VIN-${String(i + 1).padStart(3, '0')}-${rand(10000, 99999)}`,
    status:         pick(['在庫', '修理中', '販売済', 'メンテ中', '納車待ち']),
    purchase_price: String(rand(30, 250) * 10000), sale_price: String(rand(50, 350) * 10000),
    description:    `${MARKER} 確認用車両 #${i + 1}`,
  }))
  await db.insert(schema.vehicles).values(vehVals)
  console.log(`  ✅ 車両 ${vehVals.length}`)

  // 部品 20
  const PART = ['フロントバンパー', 'リアバンパー', 'ボンネット', 'ドアミラー', 'ヘッドライト', 'テールランプ', 'フェンダー', 'ラジエーター', 'ブレーキパッド', 'ワイパーゴム', 'エアフィルター', 'オイルフィルター', 'バッテリー', 'タイヤ', 'マフラー']
  const partVals = Array.from({ length: 20 }, (_, i) => ({
    part_number:   `DEV-P${String(i + 1).padStart(4, '0')}`,
    name:          `${PART[i % PART.length]} ${pick(MODELS)}用`,
    category:      pick(['外装', '内装', '電装', '機関', '消耗品']),
    supplier_account_id: supplierIds.length ? supplierIds[i % supplierIds.length] : null,
    unit_price:    String(rand(2, 80) * 1000), reorder_level: rand(0, 5),
    description:   `${MARKER} 確認用部品 #${i + 1}`,
  }))
  await db.insert(schema.parts).values(partVals)
  console.log(`  ✅ 部品 ${partVals.length}`)

  // スタッフ 20
  const staffVals = Array.from({ length: 20 }, (_, i) => ({
    name:               `${FAM[i % FAM.length]} ${GIV[(i + 5) % GIV.length]}`,
    name_kana:          `${KANA[i % KANA.length]} ${KANA[(i + 3) % KANA.length]}`,
    gender:             i % 2 === 0 ? '男性' : '女性',
    phone:              `080-${rand(1000, 9999)}-${rand(1000, 9999)}`,
    email:              `dev_staff${i + 1}@example.co.jp`,
    belong_account_id:  supplierIds.length ? supplierIds[i % supplierIds.length] : null,
    default_fixed_rate: String(rand(8, 20) * 1000), is_repeat: i % 3 === 0,
    status:             pick(['稼働中', '稼働中', '一時休止']),
    notes:              `${MARKER} 確認用スタッフ #${i + 1}`,
  }))
  await db.insert(schema.staff).values(staffVals)
  console.log(`  ✅ スタッフ ${staffVals.length}`)

  // ── モジュール有効化（dev license。getLicense は tenant_key='default' を読む）──
  const ALL_MODULES = ['crm-core', 'sales', 'expenses', 'real-estate', 'auto-body', 'staffing']
  const [lic] = await db.select().from(schema.licenses).where(eq(schema.licenses.tenant_key, 'default')).limit(1)
  if (lic) {
    const features = { ...(lic.features as Record<string, unknown>), enabled_modules: ALL_MODULES, entitled_modules: ALL_MODULES }
    await db.update(schema.licenses).set({ features, status: 'active', expires_at: null }).where(eq(schema.licenses.id, lic.id))
    console.log('  ✅ license(default) 更新（enabled_modules=全業種, status=active, 期限なし）')
  } else {
    await db.insert(schema.licenses).values({
      tenant_key: 'default', plan: 'all', status: 'active', expires_at: null,
      features: { enabled_modules: ALL_MODULES, entitled_modules: ALL_MODULES },
    })
    console.log('  ✅ license(default) 新規作成（全業種有効・期限なし）')
  }

  console.log('🎉 完了')
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
