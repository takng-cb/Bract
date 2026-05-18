/**
 * 整備（maintenance）モジュールの試験データ投入スクリプト。
 *
 * 投入内容:
 *   - 取引先 (accounts) - 既存があれば再利用、無ければ作成
 *   - 個人顧客 (contacts, consumer)
 *   - 顧客車両 (customer_vehicles) 10台
 *   - 整備 (maintenance_records) 15件（予約/受付/作業中/納車待ち/完了/キャンセル の各ステータス）
 *   - 行アイテム (maintenance_line_items)
 *   - 諸費用 (maintenance_fees)
 *   - 入金 (maintenance_payments)  ※納車待ち・完了のみ
 *
 * 実行:
 *   # auto-body Neon を指す .env.local がある前提
 *   npx tsx scripts/seed-maintenance.ts
 *
 *   # 別の Neon に向けて
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-maintenance.ts
 *
 * 冪等性:
 *   - accounts/contacts は名前検索で再利用（INSERT ... ON CONFLICT は使わず find-or-insert）
 *   - customer_vehicles / maintenance_records は毎回新規作成（重複してもエラーにはならない）
 *   - maintenance_no が UNIQUE 衝突したら過去日に slide させて再試行する
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// 担当者 UID（seed-auto-body と同じデフォルト。auth.users に存在する UID。
// 必要なら OWNER_UID 環境変数で override 可）
const OWNER_UID = process.env.OWNER_UID ?? '433b73c2-a155-4432-bd3c-6270f54b5242'

// データ整合性のため、TODAY は固定（実行日変動を避ける）
const TODAY = new Date('2026-05-16')

function dateOffset(days: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function ymd(days: number): string {
  return dateOffset(days).replace(/-/g, '')
}

/** name で account を探し、無ければ INSERT して id を返す */
async function findOrCreateAccount(
  name: string,
  industry: string,
  type: string,
  phone: string,
  address: string,
  description: string,
): Promise<string> {
  const existing = await sql`SELECT id FROM accounts WHERE name = ${name} LIMIT 1`
  if (existing.length > 0) return existing[0].id as string
  const [row] = await sql`
    INSERT INTO accounts (name, industry, type, phone, address, status, description)
    VALUES (${name}, ${industry}, ${type}, ${phone}, ${address}, 'active', ${description})
    RETURNING id
  `
  return row.id as string
}

/** full_name + contact_type で contact を探し、無ければ INSERT して id を返す */
async function findOrCreateContact(
  fullName: string,
  contactType: 'consumer' | 'business',
  accountId: string | null,
  email: string,
  phone: string,
  description: string,
): Promise<string> {
  const existing = accountId
    ? await sql`SELECT id FROM contacts WHERE full_name = ${fullName} AND contact_type = ${contactType} AND account_id = ${accountId} LIMIT 1`
    : await sql`SELECT id FROM contacts WHERE full_name = ${fullName} AND contact_type = ${contactType} AND account_id IS NULL LIMIT 1`
  if (existing.length > 0) return existing[0].id as string
  const [row] = await sql`
    INSERT INTO contacts (account_id, contact_type, full_name, email, phone, description)
    VALUES (${accountId}, ${contactType}, ${fullName}, ${email}, ${phone}, ${description})
    RETURNING id
  `
  return row.id as string
}

/**
 * maintenance_no を UNIQUE 衝突を回避しつつ採番。
 * 既存に同 prefix の最大 seq があれば +1 から開始する。
 */
async function nextMaintenanceNo(prefix: string): Promise<string> {
  const rows = await sql`
    SELECT maintenance_no FROM maintenance_records
    WHERE maintenance_no LIKE ${prefix + '-%'}
    ORDER BY maintenance_no DESC LIMIT 1
  `
  let seq = 1
  if (rows.length > 0) {
    const last = rows[0].maintenance_no as string
    const n = Number(last.split('-').pop())
    if (Number.isFinite(n)) seq = n + 1
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

async function main() {
  console.log('🌱 Seeding maintenance test data...')
  console.log(`   DB host: ${(process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? '(unknown)'}`)
  console.log(`   TODAY = ${TODAY.toISOString().slice(0, 10)}`)

  // ────────────────────────────────────────────────
  // 取引先（find or create）
  // ────────────────────────────────────────────────
  console.log('  Resolving accounts...')
  const accLeasing   = await findOrCreateAccount('みらいオートリース', '自動車リース', '顧客',     '03-5555-1212', '東京都港区芝公園4-1-1',          '法人向けリース車両のメンテ依頼元')
  const accInsurance = await findOrCreateAccount('東京海上火災',       '保険',         'パートナー','03-3211-3211', '東京都千代田区丸の内1-2-1',      '事故車修理の保険会社')
  const accBodyChain = await findOrCreateAccount('車検サポート関東',   '整備',         'パートナー','048-555-7777', '埼玉県さいたま市大宮区桜木町1-1-1','車検代行ネットワーク')
  const accCorp      = await findOrCreateAccount('株式会社グリーン物流','物流',        '顧客',     '044-333-1212', '神奈川県川崎市幸区堀川町1-1',     '商用バン3台の整備契約')
  const accPersonal  = await findOrCreateAccount('個人',               '個人',         '顧客',     '',             '',                                '個人顧客の包括取引先（contact 主体）')

  // ────────────────────────────────────────────────
  // 個人顧客（consumer contacts）
  // ────────────────────────────────────────────────
  console.log('  Resolving consumer contacts...')
  const ctTanaka   = await findOrCreateContact('田中 太郎',     'consumer', null, 'tanaka.taro@example.com',  '090-1111-1111', 'リピーター・乗用車整備中心')
  const ctYamada   = await findOrCreateContact('山田 花子',     'consumer', null, 'yamada.hanako@example.com','080-2222-2222', '軽自動車中心')
  const ctSato     = await findOrCreateContact('佐藤 健一',     'consumer', null, 'sato.ken@example.com',     '070-3333-3333', '事故板金経験あり')
  const ctSuzuki   = await findOrCreateContact('鈴木 美咲',     'consumer', null, 'suzuki.misaki@example.com','090-4444-4444', '通勤車・定期車検')
  const ctIto      = await findOrCreateContact('伊藤 葵',       'consumer', null, 'ito.aoi@example.com',      '070-6666-6666', 'SUV乗り')
  const ctKobayashi= await findOrCreateContact('小林 健太',     'consumer', null, 'kobayashi@example.com',    '090-7777-7777', 'ファミリーカーユーザー')
  const ctNakamura = await findOrCreateContact('中村 美穂',     'consumer', null, 'nakamura@example.com',     '080-8888-8888', '軽自動車・短距離通勤')
  const ctYoshida  = await findOrCreateContact('吉田 慎也',     'consumer', null, 'yoshida@example.com',      '070-9999-9999', 'ローダウン仕様、頻繁な点検')

  // 法人窓口
  const ctMiraiOkada = await findOrCreateContact('岡田 真理', 'business', accLeasing, 'okada@mirai-lease.example.com', '03-5555-1212', 'フリート管理担当')
  const ctGreenSato  = await findOrCreateContact('佐々木 浩',  'business', accCorp,   'sasaki@green-logi.example.com', '044-333-1212', '配送車両担当')

  // ────────────────────────────────────────────────
  // 顧客車両（customer_vehicles）
  //   (account_id, plate_number) で既存があれば再利用、無ければ INSERT
  // ────────────────────────────────────────────────
  console.log('  Resolving customer_vehicles...')

  type CvSeed = {
    account_id: string
    transport_branch: string
    classification_number: string
    kana: string
    plate_number: string
    car_name: string
    car_model: string
    grade: string
    vehicle_kind: string
    vehicle_usage: string
    private_business: string
    body_shape: string
    vin: string
    type_designation: string
    class_category: string
    first_registration_year: string
    first_registration_month: string
    inspection_due_date: string
    memo: string
  }

  async function findOrCreateCv(s: CvSeed): Promise<{ id: string }> {
    const found = await sql`
      SELECT id FROM customer_vehicles
      WHERE account_id = ${s.account_id} AND plate_number = ${s.plate_number}
      LIMIT 1
    `
    if (found.length > 0) return { id: found[0].id as string }
    const [row] = await sql`
      INSERT INTO customer_vehicles (
        account_id, transport_branch, classification_number, kana, plate_number,
        car_name, car_model, grade, vehicle_kind, vehicle_usage, private_business, body_shape,
        vin, type_designation, class_category,
        first_registration_year, first_registration_month, inspection_due_date,
        memo, owner_id
      ) VALUES (
        ${s.account_id}, ${s.transport_branch}, ${s.classification_number}, ${s.kana}, ${s.plate_number},
        ${s.car_name}, ${s.car_model}, ${s.grade}, ${s.vehicle_kind}, ${s.vehicle_usage}, ${s.private_business}, ${s.body_shape},
        ${s.vin}, ${s.type_designation}, ${s.class_category},
        ${s.first_registration_year}, ${s.first_registration_month}, ${s.inspection_due_date},
        ${s.memo}, ${OWNER_UID}
      )
      RETURNING id
    `
    return { id: row.id as string }
  }

  const cvSeeds: CvSeed[] = [
    // ── 個人顧客の車両 ──
    { account_id: accPersonal, transport_branch: '品川',  classification_number: '500', kana: 'あ', plate_number: '12-34',
      car_name: 'トヨタ',   car_model: 'プリウス',     grade: 'S',      vehicle_kind: '小型', vehicle_usage: '乗用', private_business: '自家用', body_shape: 'セダン',
      vin: 'ZVW50-0102030', type_designation: '17046', class_category: '0001',
      first_registration_year: '令和2', first_registration_month: '6', inspection_due_date: dateOffset(40),
      memo: '田中様 通勤車' },
    { account_id: accPersonal, transport_branch: '世田谷', classification_number: '580', kana: 'い', plate_number: '23-45',
      car_name: 'ホンダ',   car_model: 'N-BOX',       grade: 'カスタムG', vehicle_kind: '軽', vehicle_usage: '乗用', private_business: '自家用', body_shape: '軽自動車',
      vin: 'JF3-0203040',  type_designation: '12345', class_category: '0002',
      first_registration_year: '令和3', first_registration_month: '10', inspection_due_date: dateOffset(120),
      memo: '山田様 セカンドカー' },
    { account_id: accPersonal, transport_branch: '横浜',   classification_number: '300', kana: 'う', plate_number: '34-56',
      car_name: 'スズキ',   car_model: 'ハスラー',    grade: 'Xターボ', vehicle_kind: '軽', vehicle_usage: '乗用', private_business: '自家用', body_shape: '軽自動車',
      vin: 'MR52S-0304050', type_designation: '54321', class_category: '0003',
      first_registration_year: '令和3', first_registration_month: '4', inspection_due_date: dateOffset(-10),
      memo: '佐藤様 事故修理中' },
    { account_id: accPersonal, transport_branch: '湘南',   classification_number: '500', kana: 'え', plate_number: '45-67',
      car_name: 'マツダ',   car_model: 'CX-5',        grade: 'XD-L',   vehicle_kind: '普通', vehicle_usage: '乗用', private_business: '自家用', body_shape: 'SUV',
      vin: 'KF2P-0405060', type_designation: '67890', class_category: '0004',
      first_registration_year: '令和2', first_registration_month: '12', inspection_due_date: dateOffset(60),
      memo: '鈴木様 メイン車（リピーター）' },
    { account_id: accPersonal, transport_branch: '練馬',   classification_number: '300', kana: 'お', plate_number: '56-78',
      car_name: 'トヨタ',   car_model: 'ハリアー',    grade: 'Z',      vehicle_kind: '普通', vehicle_usage: '乗用', private_business: '自家用', body_shape: 'SUV',
      vin: 'AXUH80-0506070', type_designation: '11223', class_category: '0005',
      first_registration_year: '令和4', first_registration_month: '3', inspection_due_date: dateOffset(200),
      memo: '伊藤様 ご家族の足' },
    { account_id: accPersonal, transport_branch: '川崎',   classification_number: '500', kana: 'か', plate_number: '67-89',
      car_name: '日産',     car_model: 'セレナ',      grade: 'ハイウェイスター', vehicle_kind: '普通', vehicle_usage: '乗用', private_business: '自家用', body_shape: 'ミニバン',
      vin: 'C27-0607080',  type_designation: '44556', class_category: '0006',
      first_registration_year: '平成31', first_registration_month: '4', inspection_due_date: dateOffset(15),
      memo: '小林様 ファミリーカー' },
    { account_id: accPersonal, transport_branch: '足立',   classification_number: '580', kana: 'き', plate_number: '78-90',
      car_name: 'ダイハツ', car_model: 'タント',      grade: 'X',      vehicle_kind: '軽', vehicle_usage: '乗用', private_business: '自家用', body_shape: '軽自動車',
      vin: 'LA650S-0708090', type_designation: '77889', class_category: '0007',
      first_registration_year: '令和5', first_registration_month: '8', inspection_due_date: dateOffset(300),
      memo: '中村様 新車購入後初回点検' },
    { account_id: accPersonal, transport_branch: '横浜',   classification_number: '300', kana: 'く', plate_number: '89-01',
      car_name: 'スバル',   car_model: 'インプレッサ',grade: 'STI',    vehicle_kind: '普通', vehicle_usage: '乗用', private_business: '自家用', body_shape: 'セダン',
      vin: 'GVB-0809010',  type_designation: '99001', class_category: '0008',
      first_registration_year: '平成30', first_registration_month: '5', inspection_due_date: dateOffset(80),
      memo: '吉田様 走り屋仕様' },
    // ── 法人車両 ──
    { account_id: accLeasing, transport_branch: '品川',   classification_number: '400', kana: 'け', plate_number: '11-22',
      car_name: 'いすゞ',   car_model: 'エルフ',      grade: '1.5t',   vehicle_kind: '小型', vehicle_usage: '貨物', private_business: '事業用', body_shape: '平ボディトラック',
      vin: 'NMR85-0010203', type_designation: '22334', class_category: '0009',
      first_registration_year: '令和3', first_registration_month: '7', inspection_due_date: dateOffset(30),
      memo: 'みらいオートリース→リース先 物流業者' },
    { account_id: accCorp,    transport_branch: '川崎',   classification_number: '400', kana: 'こ', plate_number: '22-33',
      car_name: 'トヨタ',   car_model: 'ハイエース',  grade: 'DX',     vehicle_kind: '普通', vehicle_usage: '貨物', private_business: '事業用', body_shape: 'バントラック',
      vin: 'KDH201V-0011223', type_designation: '33445', class_category: '0010',
      first_registration_year: '令和4', first_registration_month: '1', inspection_due_date: dateOffset(45),
      memo: 'グリーン物流 配送車（5台中1号車）' },
  ]

  const cvsTyped: Array<{ id: string }> = []
  for (const s of cvSeeds) cvsTyped.push(await findOrCreateCv(s))
  const [cvPrius, cvNBox, cvHustler, cvCX5, cvHarrier, cvSerena, cvTanto, cvImpreza, cvElf, cvHiace] = cvsTyped
  console.log(`    ✓ ${cvsTyped.length} 台`)

  // ────────────────────────────────────────────────
  // 整備（maintenance_records）+ 行アイテム + 諸費用 + 入金
  // ────────────────────────────────────────────────
  console.log('  Inserting maintenance_records...')

  // 各 maintenance の (cv, account, contact, intakeDays, status, intakeCategory, memo, lever_rate)
  // status と intakeDays の組み合わせを業務に近い形に設定
  type Plan = {
    cv: { id: string }
    account: string
    contact: string | null
    intakeDays: number
    deliveryDays: number | null
    status: '予約' | '受付' | '作業中' | '納車待ち' | '完了' | 'キャンセル'
    category: string
    receptionOwner: string | null
    workerOwner: string | null
    internalMemo: string | null
    workOrderNote: string | null
    generalNote: string | null
    mileage: number | null
    lines: Array<{
      work_category: string
      item_name: string
      hours?: number
      labor_amount?: number
      parts_qty?: number
      parts_unit?: string
      parts_unit_price?: number
      cost_unit_price?: number
      note?: string
      state?: string
      is_excluded?: boolean
      work_status?: '未完了' | '完了'
    }>
    fees: Array<{ category: '課税' | '非課税'; item_name: string; amount: number; cost_amount?: number }>
    payments: Array<{ method: string; amount: number; daysFromIntake: number; memo?: string }>
  }

  const plans: Plan[] = [
    // ── 完了案件（行・諸費用・入金フル）─────────────────────
    {
      cv: cvPrius, account: accPersonal, contact: ctTanaka,
      intakeDays: -45, deliveryDays: -40, status: '完了',
      category: '車検', mileage: 65000,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '田中様 リピーター・例年通り',
      workOrderNote: 'エンジンオイル交換、ブレーキパッド残量チェック',
      generalNote: '次回車検は2年後',
      lines: [
        { work_category: '車検', item_name: '24ヶ月点検整備', hours: 2.0, labor_amount: 20000, work_status: '完了' },
        { work_category: '車検', item_name: 'ブレーキ分解清掃', hours: 1.5, labor_amount: 15000, work_status: '完了' },
        { work_category: '消耗品', item_name: 'エンジンオイル交換', hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1200, cost_unit_price: 700, work_status: '完了' },
        { work_category: '消耗品', item_name: 'オイルエレメント', parts_qty: 1, parts_unit: '個', parts_unit_price: 1800, cost_unit_price: 1000, work_status: '完了' },
        { work_category: '消耗品', item_name: 'ワイパーゴム交換', parts_qty: 2, parts_unit: '本', parts_unit_price: 800, cost_unit_price: 400, work_status: '完了' },
      ],
      fees: [
        { category: '非課税', item_name: '自賠責保険（24ヶ月）', amount: 17650, cost_amount: 17650 },
        { category: '非課税', item_name: '自動車重量税',         amount: 24600, cost_amount: 24600 },
        { category: '非課税', item_name: '印紙代',               amount: 1800,  cost_amount: 1800 },
        { category: '課税',   item_name: '検査代行料',           amount: 8000 },
      ],
      payments: [
        { method: '現金', amount: 110000, daysFromIntake: 5, memo: '納車時お支払い' },
      ],
    },
    {
      cv: cvCX5, account: accPersonal, contact: ctSuzuki,
      intakeDays: -30, deliveryDays: -28, status: '完了',
      category: '一般整備', mileage: 48000,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '鈴木様 定期点検',
      workOrderNote: null, generalNote: null,
      lines: [
        { work_category: '点検', item_name: '12ヶ月点検整備', hours: 1.5, labor_amount: 15000, work_status: '完了' },
        { work_category: '消耗品', item_name: 'エンジンオイル交換（ディーゼル）', hours: 0.3, labor_amount: 3000, parts_qty: 5, parts_unit: 'L', parts_unit_price: 1500, cost_unit_price: 900, work_status: '完了' },
        { work_category: '消耗品', item_name: 'エアコンフィルター',  parts_qty: 1, parts_unit: '個', parts_unit_price: 3500, cost_unit_price: 1800, work_status: '完了' },
      ],
      fees: [],
      payments: [
        { method: '銀行振込', amount: 33000, daysFromIntake: 4, memo: '振込確認済み' },
      ],
    },
    {
      cv: cvSerena, account: accPersonal, contact: ctKobayashi,
      intakeDays: -60, deliveryDays: -55, status: '完了',
      category: '板金修理', mileage: 78000,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '小林様 駐車場で擦った件、保険使用',
      workOrderNote: 'リアバンパー塗装、左クォーター板金',
      generalNote: '東京海上 立会い済み',
      lines: [
        { work_category: '板金', item_name: 'リアバンパー脱着・調整', hours: 1.5, labor_amount: 15000, work_status: '完了' },
        { work_category: '板金', item_name: '左クォーター板金',     hours: 4.0, labor_amount: 48000, work_status: '完了' },
        { work_category: '塗装', item_name: 'バンパー＋クォーター塗装', hours: 5.0, labor_amount: 60000, work_status: '完了' },
        { work_category: '部品', item_name: 'リアバンパー（新品）', parts_qty: 1, parts_unit: '個', parts_unit_price: 45000, cost_unit_price: 28000, work_status: '完了' },
        { work_category: '部品', item_name: '塗料・パテ類',         parts_qty: 1, parts_unit: '式', parts_unit_price: 12000, cost_unit_price: 6500, work_status: '完了' },
      ],
      fees: [
        { category: '課税', item_name: '出張引取（往復20km）', amount: 5000, cost_amount: 2000 },
      ],
      payments: [
        { method: '銀行振込', amount: 200000, daysFromIntake: 7, memo: '東京海上より 振込済' },
        { method: '銀行振込', amount: 50000,  daysFromIntake: 10, memo: '差額 小林様' },
      ],
    },

    // ── 納車待ち（入金あり/なし）─────────────────────────
    {
      cv: cvTanto, account: accPersonal, contact: ctNakamura,
      intakeDays: -5, deliveryDays: 1, status: '納車待ち',
      category: '新車納車整備', mileage: 12,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '中村様 新車購入後の納車整備',
      workOrderNote: '陸送、コーティング、ドラレコ取付',
      generalNote: null,
      lines: [
        { work_category: '納車整備', item_name: '新車納車前点検', hours: 1.0, labor_amount: 10000, work_status: '完了' },
        { work_category: 'コーティング', item_name: 'ガラスコーティング施工', hours: 4.0, labor_amount: 30000, parts_qty: 1, parts_unit: '式', parts_unit_price: 25000, cost_unit_price: 12000, work_status: '完了' },
        { work_category: '取付', item_name: 'ドライブレコーダー前後取付', hours: 1.5, labor_amount: 12000, parts_qty: 1, parts_unit: '台', parts_unit_price: 28000, cost_unit_price: 18000, work_status: '完了' },
      ],
      fees: [
        { category: '課税', item_name: '納車陸送費', amount: 8000, cost_amount: 5000 },
      ],
      payments: [
        { method: '現金', amount: 50000, daysFromIntake: 0, memo: '前金' },
      ],
    },
    {
      cv: cvHarrier, account: accPersonal, contact: ctIto,
      intakeDays: -3, deliveryDays: 2, status: '納車待ち',
      category: '車検', mileage: 23000,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '伊藤様 ご指定で代車不要',
      workOrderNote: null, generalNote: null,
      lines: [
        { work_category: '車検', item_name: '24ヶ月点検整備', hours: 2.0, labor_amount: 22000, work_status: '完了' },
        { work_category: '消耗品', item_name: 'ブレーキフルード交換', hours: 0.5, labor_amount: 4500, parts_qty: 1, parts_unit: 'L', parts_unit_price: 2200, cost_unit_price: 1200, work_status: '完了' },
        { work_category: '消耗品', item_name: 'エンジンオイル交換', hours: 0.3, labor_amount: 3000, parts_qty: 4, parts_unit: 'L', parts_unit_price: 1500, cost_unit_price: 900, work_status: '完了' },
      ],
      fees: [
        { category: '非課税', item_name: '自賠責保険（24ヶ月）', amount: 17650, cost_amount: 17650 },
        { category: '非課税', item_name: '自動車重量税',         amount: 32800, cost_amount: 32800 },
        { category: '非課税', item_name: '印紙代',               amount: 1800,  cost_amount: 1800 },
        { category: '課税',   item_name: '検査代行料',           amount: 8000 },
      ],
      payments: [],  // 納車時清算
    },

    // ── 作業中 ────────────────────────────────────────────
    {
      cv: cvHustler, account: accPersonal, contact: ctSato,
      intakeDays: -7, deliveryDays: 5, status: '作業中',
      category: '板金修理', mileage: 35000,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '佐藤様 接触事故 (10:0で過失なし)',
      workOrderNote: '左フロントフェンダー＋ドア板金、塗装',
      generalNote: '保険会社：東京海上、立会済',
      lines: [
        { work_category: '板金', item_name: '左フロントドア板金',      hours: 5.0, labor_amount: 60000, work_status: '完了' },
        { work_category: '板金', item_name: '左フロントフェンダー板金', hours: 3.0, labor_amount: 36000, work_status: '完了' },
        { work_category: '塗装', item_name: '塗装（フェンダー＋ドア）', hours: 6.0, labor_amount: 72000, work_status: '未完了', state: '塗装乾燥中' },
        { work_category: '部品', item_name: 'ドアミラー（左）交換',    parts_qty: 1, parts_unit: '個', parts_unit_price: 18000, cost_unit_price: 11000, work_status: '完了' },
      ],
      fees: [],
      payments: [],
    },
    {
      cv: cvElf, account: accLeasing, contact: ctMiraiOkada,
      intakeDays: -2, deliveryDays: 3, status: '作業中',
      category: '車検', mileage: 105000,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: 'みらいオート リース車',
      workOrderNote: 'ブレーキ整備（要点検）',
      generalNote: '法人リース、請求はみらいオート宛',
      lines: [
        { work_category: '車検', item_name: '24ヶ月点検整備（小型貨物）', hours: 3.0, labor_amount: 30000, work_status: '完了' },
        { work_category: '整備', item_name: 'ブレーキ分解整備',          hours: 2.0, labor_amount: 22000, work_status: '未完了', state: '部品取置中' },
        { work_category: '部品', item_name: 'ブレーキパッド（前）',      parts_qty: 1, parts_unit: 'set', parts_unit_price: 12000, cost_unit_price: 7500, work_status: '未完了' },
        { work_category: '消耗品', item_name: 'エンジンオイル交換',      hours: 0.5, labor_amount: 4000, parts_qty: 8, parts_unit: 'L', parts_unit_price: 1300, cost_unit_price: 750, work_status: '完了' },
      ],
      fees: [
        { category: '非課税', item_name: '自賠責保険（24ヶ月・貨物）', amount: 25830, cost_amount: 25830 },
        { category: '非課税', item_name: '自動車重量税',              amount: 26400, cost_amount: 26400 },
        { category: '非課税', item_name: '印紙代',                    amount: 2200,  cost_amount: 2200 },
      ],
      payments: [],
    },

    // ── 受付（作業未着手）─────────────────────────────────
    {
      cv: cvImpreza, account: accPersonal, contact: ctYoshida,
      intakeDays: -1, deliveryDays: 7, status: '受付',
      category: '一般整備', mileage: 92000,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: '吉田様 異音相談（足回り）',
      workOrderNote: '足回りチェック、必要なら部品交換',
      generalNote: '見積要連絡',
      lines: [
        { work_category: '点検', item_name: '足回り総合診断', hours: 1.0, labor_amount: 10000, work_status: '未完了' },
      ],
      fees: [],
      payments: [],
    },
    {
      cv: cvHiace, account: accCorp, contact: ctGreenSato,
      intakeDays: 0, deliveryDays: 3, status: '受付',
      category: '一般整備', mileage: 58000,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: 'グリーン物流 配送車',
      workOrderNote: 'タイヤローテーション＋オイル交換',
      generalNote: '法人契約、月次請求',
      lines: [],
      fees: [],
      payments: [],
    },

    // ── 予約（未来分）─────────────────────────────────────
    {
      cv: cvNBox, account: accPersonal, contact: ctYamada,
      intakeDays: 7, deliveryDays: 9, status: '予約',
      category: '車検', mileage: 22000,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: '山田様 初回車検',
      workOrderNote: null, generalNote: null,
      lines: [],
      fees: [],
      payments: [],
    },
    {
      cv: cvCX5, account: accPersonal, contact: ctSuzuki,
      intakeDays: 14, deliveryDays: 14, status: '予約',
      category: '一般整備', mileage: 49000,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: '鈴木様 オイル交換（次回予約）',
      workOrderNote: null, generalNote: null,
      lines: [],
      fees: [],
      payments: [],
    },
    {
      cv: cvHarrier, account: accPersonal, contact: ctIto,
      intakeDays: 21, deliveryDays: 21, status: '予約',
      category: '点検', mileage: 24000,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: '伊藤様 12ヶ月点検',
      workOrderNote: null, generalNote: null,
      lines: [],
      fees: [],
      payments: [],
    },

    // ── キャンセル（少数）────────────────────────────────
    {
      cv: cvImpreza, account: accPersonal, contact: ctYoshida,
      intakeDays: -10, deliveryDays: null, status: 'キャンセル',
      category: '一般整備', mileage: null,
      receptionOwner: OWNER_UID, workerOwner: null,
      internalMemo: '吉田様 都合によりキャンセル',
      workOrderNote: null, generalNote: 'キャンセル理由：他店で実施済み',
      lines: [],
      fees: [],
      payments: [],
    },

    // ── 大型修理（保険会社請求）─────────────────────────
    {
      cv: cvSerena, account: accPersonal, contact: ctKobayashi,
      intakeDays: -90, deliveryDays: -80, status: '完了',
      category: '事故修理', mileage: 76000,
      receptionOwner: OWNER_UID, workerOwner: OWNER_UID,
      internalMemo: '小林様 過去事故対応（記録用）',
      workOrderNote: '前回事故修理',
      generalNote: '東京海上経由',
      lines: [
        { work_category: '板金', item_name: 'フロントバンパー脱着',  hours: 1.0, labor_amount: 10000, work_status: '完了' },
        { work_category: '板金', item_name: 'ボンネット凹み板金',    hours: 3.5, labor_amount: 42000, work_status: '完了' },
        { work_category: '塗装', item_name: 'ボンネット塗装',        hours: 4.0, labor_amount: 48000, work_status: '完了' },
        { work_category: '部品', item_name: 'フロントグリル新品',    parts_qty: 1, parts_unit: '個', parts_unit_price: 28000, cost_unit_price: 16000, work_status: '完了' },
        { work_category: '部品', item_name: 'ヘッドライト（左）',    parts_qty: 1, parts_unit: '個', parts_unit_price: 52000, cost_unit_price: 32000, work_status: '完了' },
      ],
      fees: [
        { category: '課税', item_name: 'レンタカー代行（5日）', amount: 25000, cost_amount: 12000 },
      ],
      payments: [
        { method: '銀行振込', amount: 230000, daysFromIntake: 12, memo: '東京海上' },
      ],
    },
  ]

  let createdMaintenance = 0
  let createdLines = 0
  let createdFees = 0
  let createdPayments = 0
  // 後段で 活動・ToDo・経費 を紐付けるために、insert された (id, plan) を保持
  const createdMaintList: Array<{ id: string; plan: Plan }> = []

  for (let i = 0; i < plans.length; i++) {
    const p = plans[i]
    const prefix = ymd(p.intakeDays)

    // 既存の (cv, intake_date, status) で一致する maintenance があれば再利用
    // ※ 何度実行しても整備本体は重複しない設計
    const existing = await sql`
      SELECT id FROM maintenance_records
      WHERE customer_vehicle_id = ${p.cv.id}
        AND intake_date = ${dateOffset(p.intakeDays)}
        AND status = ${p.status}
        AND intake_category = ${p.category}
      LIMIT 1
    `
    if (existing.length > 0) {
      const mid = existing[0].id as string
      createdMaintList.push({ id: mid, plan: p })
      continue  // 子（行アイテム/諸費用/入金）も既に作られているはずなのでスキップ
    }

    // UNIQUE 衝突回避（同 prefix の次連番）
    let no: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      no = await nextMaintenanceNo(prefix)
      try {
        const [m] = await sql`
          INSERT INTO maintenance_records (
            maintenance_no, customer_vehicle_id, account_id, contact_id, billing_account_id,
            intake_date, delivery_date, mileage, branch_id, intake_category,
            reception_owner_id, worker_owner_id,
            internal_memo, work_order_note, general_note,
            tax_mode, tax_rounding, lever_rate,
            status, owner_id
          ) VALUES (
            ${no}, ${p.cv.id}, ${p.account}, ${p.contact},
            ${p.account === accLeasing || p.account === accCorp ? p.account : null},
            ${dateOffset(p.intakeDays)}, ${p.deliveryDays != null ? dateOffset(p.deliveryDays) : null},
            ${p.mileage}, '本店', ${p.category},
            ${p.receptionOwner}, ${p.workerOwner},
            ${p.internalMemo}, ${p.workOrderNote}, ${p.generalNote},
            '税別10%', '切り捨て', 10000,
            ${p.status}, ${OWNER_UID}
          )
          RETURNING id, maintenance_no
        `
        createdMaintenance++

        // 行アイテム
        for (let li = 0; li < p.lines.length; li++) {
          const l = p.lines[li]
          await sql`
            INSERT INTO maintenance_line_items (
              maintenance_id, sort_order, work_category, item_name,
              hours, labor_amount, parts_qty, parts_unit, parts_unit_price, cost_unit_price,
              note, state, is_excluded, work_status
            ) VALUES (
              ${m.id}, ${li}, ${l.work_category}, ${l.item_name},
              ${l.hours ?? null}, ${l.labor_amount ?? null},
              ${l.parts_qty ?? null}, ${l.parts_unit ?? null}, ${l.parts_unit_price ?? null}, ${l.cost_unit_price ?? null},
              ${l.note ?? null}, ${l.state ?? null}, ${l.is_excluded ?? false}, ${l.work_status ?? '未完了'}
            )
          `
          createdLines++
        }

        // 諸費用
        for (let fi = 0; fi < p.fees.length; fi++) {
          const f = p.fees[fi]
          await sql`
            INSERT INTO maintenance_fees (maintenance_id, sort_order, category, item_name, amount, cost_amount)
            VALUES (${m.id}, ${fi}, ${f.category}, ${f.item_name}, ${f.amount}, ${f.cost_amount ?? null})
          `
          createdFees++
        }

        // 入金
        for (const pay of p.payments) {
          await sql`
            INSERT INTO maintenance_payments (maintenance_id, payment_method, memo, amount, payment_date, owner_id, branch_id)
            VALUES (${m.id}, ${pay.method}, ${pay.memo ?? null}, ${pay.amount}, ${dateOffset(p.intakeDays + pay.daysFromIntake)}, ${OWNER_UID}, '本店')
          `
          createdPayments++
        }

        createdMaintList.push({ id: m.id as string, plan: p })
        no = null  // 成功印
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!/maintenance_no|unique|duplicate/i.test(msg)) {
          console.error(`  ✗ plan[${i}] insert failed: ${msg}`)
          throw e
        }
        // 衝突 → 次の seq を取りなおして再試行
      }
    }
    if (no !== null) console.warn(`  ⚠ plan[${i}] 5回試行しても採番できず`)
  }

  // ────────────────────────────────────────────────
  // 活動・ToDo・経費（junction で maintenance に紐付け）
  //   each plan のステータスに応じて業務に近いパターンで生成
  // ────────────────────────────────────────────────
  console.log('  Inserting activities / tasks / expenses (関連: maintenance)...')

  let createdActivities = 0
  let createdTasks = 0
  let createdExpenses = 0

  /** activity を挿入し、maintenance との junction を張る */
  async function insertActivity(
    maintenanceId: string,
    type: string,
    subject: string,
    body: string | null,
    occurredDays: number,
    occurredHour = 10,
    occurredMin = 0,
    // 関連を二重に張りたいとき用（contact や account など）
    extraRelations: Array<{ object_api: string; record_id: string }> = [],
  ): Promise<void> {
    const ts = new Date(TODAY)
    ts.setDate(ts.getDate() + occurredDays)
    ts.setHours(occurredHour, occurredMin, 0, 0)
    const [a] = await sql`
      INSERT INTO activities (type, subject, body, occurred_at, owner_id)
      VALUES (${type}, ${subject}, ${body}, ${ts.toISOString()}, ${OWNER_UID})
      RETURNING id
    `
    await sql`
      INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
      VALUES (${a.id}, 'maintenance', ${maintenanceId})
    `
    for (const r of extraRelations) {
      await sql`
        INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
        VALUES (${a.id}, ${r.object_api}, ${r.record_id})
        ON CONFLICT DO NOTHING
      `
    }
    createdActivities++
  }

  /** task を挿入し、maintenance との junction を張る */
  async function insertTask(
    maintenanceId: string,
    title: string,
    dueDays: number,
    done: boolean,
    priority: 'high' | 'medium' | 'low',
    extraRelations: Array<{ object_api: string; record_id: string }> = [],
  ): Promise<void> {
    const [t] = await sql`
      INSERT INTO tasks (title, due_date, done, priority)
      VALUES (${title}, ${dateOffset(dueDays)}, ${done}, ${priority})
      RETURNING id
    `
    await sql`
      INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
      VALUES (${t.id}, 'maintenance', ${maintenanceId})
    `
    for (const r of extraRelations) {
      await sql`
        INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
        VALUES (${t.id}, ${r.object_api}, ${r.record_id})
        ON CONFLICT DO NOTHING
      `
    }
    createdTasks++
  }

  /** expense を挿入し、maintenance との junction を張る */
  async function insertExpense(
    maintenanceId: string,
    title: string,
    amount: number,
    category: string,
    expenseDays: number,
    notes: string | null,
    extraRelations: Array<{ object_api: string; record_id: string }> = [],
  ): Promise<void> {
    const [e] = await sql`
      INSERT INTO expenses (title, amount, category, expense_date, notes)
      VALUES (${title}, ${amount}, ${category}, ${dateOffset(expenseDays)}, ${notes})
      RETURNING id
    `
    await sql`
      INSERT INTO expense_related_records (expense_id, related_object_api, related_record_id)
      VALUES (${e.id}, 'maintenance', ${maintenanceId})
    `
    for (const r of extraRelations) {
      await sql`
        INSERT INTO expense_related_records (expense_id, related_object_api, related_record_id)
        VALUES (${e.id}, ${r.object_api}, ${r.record_id})
        ON CONFLICT DO NOTHING
      `
    }
    createdExpenses++
  }

  for (const { id: mid, plan: p } of createdMaintList) {
    // 関連レコードは「顧客（account）」もチップ表示用に張っておく
    const extras: Array<{ object_api: string; record_id: string }> = [
      { object_api: 'account', record_id: p.account },
    ]
    if (p.contact) extras.push({ object_api: 'contact', record_id: p.contact })

    switch (p.status) {
      case '完了': {
        await insertActivity(mid, 'call',    '入庫前 電話確認',         '時間・代車要否を確認', p.intakeDays - 1, 14, 0, extras)
        await insertActivity(mid, 'meeting', '入庫・受付',               '車両確認、見積提示', p.intakeDays, 9, 30, extras)
        await insertActivity(mid, 'note',    '作業完了 記録',           '全工程完了、テスト走行OK', p.deliveryDays ?? p.intakeDays, 15, 0, extras)
        await insertActivity(mid, 'email',   '納車・請求書送付',         '請求書をメール送付', (p.deliveryDays ?? p.intakeDays) + 1, 11, 0, extras)

        await insertTask(mid, '納車前最終チェック', p.deliveryDays ?? p.intakeDays, true, 'high', extras)
        await insertTask(mid, '請求書発行',         (p.deliveryDays ?? p.intakeDays) + 1, true, 'medium', extras)

        // 部品仕入や陸送など
        if (p.lines.some((l) => l.work_category === '部品' || l.work_category === '塗装')) {
          await insertExpense(mid, '部品仕入（板金案件）', 28000, '消耗品費', p.intakeDays + 1, '日本パーツ商事 から発注', extras)
        }
        if (p.category === '車検') {
          await insertExpense(mid, '陸運局 検査持込', 6000, '交通費', p.deliveryDays ?? p.intakeDays, '検査場まで往復', extras)
        }
        break
      }
      case '納車待ち': {
        await insertActivity(mid, 'meeting', '入庫・受付',         '車両確認OK', p.intakeDays, 10, 0, extras)
        await insertActivity(mid, 'note',    '作業完了 → 納車準備', '洗車・最終確認', (p.deliveryDays ?? p.intakeDays) - 1, 17, 0, extras)
        await insertTask(mid, '納車日程の最終調整', p.deliveryDays ?? p.intakeDays, false, 'high', extras)
        if (p.category === '新車納車整備') {
          await insertExpense(mid, 'ガラスコート 材料費', 12000, '消耗品費', p.intakeDays + 1, null, extras)
        }
        break
      }
      case '作業中': {
        await insertActivity(mid, 'call',    '入庫予約 受付',     '電話で予約', p.intakeDays - 2, 11, 0, extras)
        await insertActivity(mid, 'meeting', '入庫・現車確認',     '見積確認、作業着手了承', p.intakeDays, 10, 0, extras)
        if (p.lines.some((l) => l.work_category === '部品' || l.work_category === '塗装')) {
          await insertActivity(mid, 'note',  '部品入荷待ち',       '日本パーツ商事 入荷予定 翌週', p.intakeDays + 1, 16, 0, extras)
          await insertTask(mid, '部品到着確認の電話',      p.intakeDays + 3, false, 'high', extras)
        }
        await insertTask(mid, '進捗の中間連絡（お客様向け）', p.intakeDays + 2, false, 'medium', extras)
        break
      }
      case '受付': {
        await insertActivity(mid, 'call',    '電話 入庫予約',     'お客様より連絡', p.intakeDays - 1, 13, 0, extras)
        await insertActivity(mid, 'meeting', '入庫・症状確認',     '異音／整備内容のヒアリング', p.intakeDays, 9, 0, extras)
        await insertTask(mid, '見積を作成して提示',  p.intakeDays + 1, false, 'high', extras)
        break
      }
      case '予約': {
        await insertActivity(mid, 'note', '予約受付',            '入庫予定 ' + dateOffset(p.intakeDays), p.intakeDays - 3, 10, 0, extras)
        await insertTask(mid, '入庫前 リマインド連絡', p.intakeDays - 1, false, 'medium', extras)
        break
      }
      case 'キャンセル': {
        await insertActivity(mid, 'note', 'キャンセル受付', p.generalNote ?? 'お客様都合', p.intakeDays, 11, 0, extras)
        break
      }
    }
  }

  console.log('\n✅ Seed complete.')
  console.log(`   customer_vehicles: ${cvsTyped.length} (うち新規 insert 分はログ上は表示なし)`)
  console.log(`   maintenance_records: 新規 ${createdMaintenance} / 既存再利用 ${createdMaintList.length - createdMaintenance}`)
  console.log(`   line_items: ${createdLines}, fees: ${createdFees}, payments: ${createdPayments}`)
  console.log(`   activities: ${createdActivities}, tasks: ${createdTasks}, expenses: ${createdExpenses}`)
  console.log(`   accounts re-used: みらいオートリース / 東京海上火災 / 車検サポート関東 / 株式会社グリーン物流 / 個人`)
  // accBodyChain / accInsurance はメンテ本体で参照していないが整備履歴用に作成済み
  void accBodyChain
  void accInsurance
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1) })
