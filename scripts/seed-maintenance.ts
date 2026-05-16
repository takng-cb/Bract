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
  // ────────────────────────────────────────────────
  console.log('  Inserting customer_vehicles...')
  const cvs = await sql`
    INSERT INTO customer_vehicles (
      account_id, transport_branch, classification_number, kana, plate_number,
      car_name, car_model, grade, vehicle_kind, vehicle_usage, private_business, body_shape,
      vin, type_designation, class_category,
      first_registration_year, first_registration_month, inspection_due_date,
      memo, owner_id
    ) VALUES
      -- 個人顧客の車両
      (${accPersonal}, '品川', '500', 'あ',  '12-34', 'トヨタ',   'プリウス',    'S',     '小型', '乗用', '自家用', 'セダン',
       'ZVW50-0102030', '17046', '0001',
       '令和2', '6', ${dateOffset(40)},  '田中様 通勤車', ${OWNER_UID}),

      (${accPersonal}, '世田谷', '580', 'い', '23-45', 'ホンダ',   'N-BOX',      'カスタムG','軽', '乗用', '自家用', '箱型',
       'JF3-0203040', '12345', '0002',
       '令和3', '10', ${dateOffset(120)}, '山田様 セカンドカー', ${OWNER_UID}),

      (${accPersonal}, '横浜',   '300', 'う', '34-56', 'スズキ',   'ハスラー',   'Xターボ','軽', '乗用', '自家用', '箱型',
       'MR52S-0304050', '54321', '0003',
       '令和3', '4', ${dateOffset(-10)}, '佐藤様 事故修理中', ${OWNER_UID}),

      (${accPersonal}, '湘南',   '500', 'え', '45-67', 'マツダ',   'CX-5',       'XD-L',  '普通','乗用', '自家用', 'ステーションワゴン',
       'KF2P-0405060', '67890', '0004',
       '令和2', '12', ${dateOffset(60)}, '鈴木様 メイン車（リピーター）', ${OWNER_UID}),

      (${accPersonal}, '練馬',   '300', 'お', '56-78', 'トヨタ',   'ハリアー',   'Z',     '普通','乗用', '自家用', 'ステーションワゴン',
       'AXUH80-0506070', '11223', '0005',
       '令和4', '3', ${dateOffset(200)}, '伊藤様 ご家族の足', ${OWNER_UID}),

      (${accPersonal}, '川崎',   '500', 'か', '67-89', '日産',     'セレナ',     'ハイウェイスター','普通','乗用','自家用','ステーションワゴン',
       'C27-0607080', '44556', '0006',
       '平成31', '4', ${dateOffset(15)},  '小林様 ファミリーカー', ${OWNER_UID}),

      (${accPersonal}, '足立',   '580', 'き', '78-90', 'ダイハツ', 'タント',     'X',     '軽', '乗用', '自家用', '箱型',
       'LA650S-0708090', '77889', '0007',
       '令和5', '8', ${dateOffset(300)}, '中村様 新車購入後初回点検', ${OWNER_UID}),

      (${accPersonal}, '横浜',   '300', 'く', '89-01', 'スバル',   'インプレッサ','STI','普通','乗用', '自家用', 'セダン',
       'GVB-0809010', '99001', '0008',
       '平成30', '5', ${dateOffset(80)},  '吉田様 走り屋仕様', ${OWNER_UID}),

      -- 法人車両
      (${accLeasing},  '品川',   '400', 'け', '11-22', 'いすゞ',   'エルフ',     '1.5t', '小型','貨物', '事業用', 'トラック',
       'NMR85-0010203', '22334', '0009',
       '令和3', '7', ${dateOffset(30)}, 'みらいオートリース→リース先 物流業者', ${OWNER_UID}),

      (${accCorp},     '川崎',   '400', 'こ', '22-33', 'トヨタ',   'ハイエース', 'DX',    '普通','貨物', '事業用', '箱型',
       'KDH201V-0011223', '33445', '0010',
       '令和4', '1', ${dateOffset(45)}, 'グリーン物流 配送車（5台中1号車）', ${OWNER_UID})
    RETURNING id, plate_number, car_model
  `

  // Neon の sql は Record<string, any> を返すので、id を string として明示する
  const cvsTyped = cvs as Array<{ id: string }>
  const [cvPrius, cvNBox, cvHustler, cvCX5, cvHarrier, cvSerena, cvTanto, cvImpreza, cvElf, cvHiace] = cvsTyped
  console.log(`    ✓ ${cvs.length} 台`)

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

  for (let i = 0; i < plans.length; i++) {
    const p = plans[i]
    const prefix = ymd(p.intakeDays)

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

  // 関係を accBodyChain や accInsurance とも見えるようにタグでつけておく（任意）
  console.log('\n✅ Seed complete.')
  console.log(`   customer_vehicles: ${cvs.length}`)
  console.log(`   maintenance_records: ${createdMaintenance}`)
  console.log(`   line_items: ${createdLines}, fees: ${createdFees}, payments: ${createdPayments}`)
  console.log(`   accounts re-used: みらいオートリース / 東京海上火災 / 車検サポート関東 / 株式会社グリーン物流 / 個人`)
  // accBodyChain / accInsurance はメンテ本体で参照していないが整備履歴用に作成済み
  void accBodyChain
  void accInsurance
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1) })
