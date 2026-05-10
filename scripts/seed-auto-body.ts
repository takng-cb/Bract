/**
 * auto-body 環境用の試験データ投入スクリプト。
 *
 * 投入内容:
 *   - 取引先 (法人): 中古車卸/部品商社/リース会社 等
 *   - 個人顧客 (contacts): 田中太郎/山田花子 等 (account_id=null, contact_type='consumer')
 *   - 法人担当者 (contacts): 取引先の窓口担当者
 *   - 車両: 在庫/販売済/修理中/車検中 など各状態
 *   - 商談: 車両販売/板金修理/整備/車検 を過去3ヶ月〜未来3ヶ月に散らす
 *   - 活動履歴/ToDo/経費を商談に紐付け
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// 担当者 UID（同期した users から1人指定。adminロールにする）
const OWNER_UID = '433b73c2-a155-4432-bd3c-6270f54b5242' // t_noguchi@cactus-bridge.com

const TODAY = new Date('2026-05-10')

function dateOffset(days: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function ts(days: number, hour = 10, minute = 0): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

async function main() {
  console.log('🌱 Seeding auto-body data...')

  // ════════════════════════════════════════════════════════════
  // 1. 業種マスタデータ（必須・冪等）
  //    新 auto-body Neon を立てた時にも必ず投入される。
  //    object_definitions に 'vehicles' 行が無いと
  //    /admin/objects に車両オブジェクトが出てこない。
  // ════════════════════════════════════════════════════════════
  console.log('  Ensuring auto-body master data...')
  await sql`
    INSERT INTO object_definitions (
      api_name, label, label_plural, icon,
      is_builtin, nav_enabled, sort_order,
      enable_activities, enable_tasks, enable_expenses
    )
    VALUES (
      'vehicles', '車両', '車両', '🚗',
      false, true, 100,
      true, true, true
    )
    ON CONFLICT (api_name) DO NOTHING
  `
  console.log('    ✓ object_definitions: vehicles')

  await sql`
    INSERT INTO object_definitions (
      api_name, label, label_plural, icon,
      is_builtin, nav_enabled, sort_order,
      enable_activities, enable_tasks, enable_expenses
    )
    VALUES (
      'parts', '部品', '部品マスタ', '🔧',
      false, true, 110,
      true, true, true
    )
    ON CONFLICT (api_name) DO NOTHING
  `
  console.log('    ✓ object_definitions: parts')

  // ════════════════════════════════════════════════════════════
  // 2. 試験データ（任意・dev/demo 用）
  //    本番セットアップ時に飛ばしたい場合は SEED_TEST_DATA=false で実行
  // ════════════════════════════════════════════════════════════
  if (process.env.SEED_TEST_DATA === 'false') {
    console.log('  SEED_TEST_DATA=false なので試験データはスキップ')
    console.log('\n✅ Master data only seed complete.')
    return
  }

  // ────────────────────────────────────────────────
  // 取引先 (accounts)
  // ────────────────────────────────────────────────
  console.log('  Inserting accounts...')
  const [
    accDealerA, accDealerB, accPartsCo, accLeasing, accInsurance, accBodyChain,
  ] = await sql`
    INSERT INTO accounts (name, industry, type, phone, address, status, description) VALUES
      ('オートマートさくら', '中古車販売', '仕入先',   '03-1234-5678', '東京都品川区東品川3-1-1', 'active', 'オークション仕入のメイン取引先'),
      ('カーズマーケット千葉', '中古車販売', '顧客・仕入先', '043-222-3456', '千葉県千葉市中央区中央1-2-3', 'active', '販路と仕入両方'),
      ('日本パーツ商事',     '自動車部品', '仕入先',   '06-7654-3210', '大阪府大阪市住之江区南港北1-2-3', 'active', '純正部品・OEM部品の主力卸'),
      ('みらいオートリース', '自動車リース', '顧客',     '03-5555-1212', '東京都港区芝公園4-1-1', 'active', '法人向けリース車両のメンテ依頼元'),
      ('東京海上火災',       '保険',       'パートナー', '03-3211-3211', '東京都千代田区丸の内1-2-1', 'active', '事故車修理の保険会社'),
      ('車検サポート関東',   '整備',       'パートナー', '048-555-7777', '埼玉県さいたま市大宮区桜木町1-1-1', 'active', '車検代行ネットワーク')
    RETURNING id, name
  `

  // ────────────────────────────────────────────────
  // 個人顧客 (contacts, account_id=null, type='consumer')
  // ────────────────────────────────────────────────
  console.log('  Inserting consumer contacts (個人顧客)...')
  const consumers = await sql`
    INSERT INTO contacts (account_id, contact_type, full_name, email, phone, description) VALUES
      (NULL, 'consumer', '田中 太郎', 'tanaka.taro@example.com',  '090-1111-1111', '近所のリピーター・乗用車整備中心'),
      (NULL, 'consumer', '山田 花子', 'yamada.hanako@example.com', '080-2222-2222', '軽自動車購入希望・初回来店'),
      (NULL, 'consumer', '佐藤 健一', 'sato.ken@example.com',     '070-3333-3333', '事故車板金の見積依頼'),
      (NULL, 'consumer', '鈴木 美咲', 'suzuki.misaki@example.com','090-4444-4444', '通勤車の車検依頼・継続契約'),
      (NULL, 'consumer', '高橋 大輔', 'takahashi@example.com',    '080-5555-5555', 'ファミリーカー乗換検討中'),
      (NULL, 'consumer', '伊藤 葵',   'ito.aoi@example.com',      '070-6666-6666', 'SUV購入希望、頭金あり')
    RETURNING id, full_name
  `

  // ────────────────────────────────────────────────
  // 法人担当者 (contacts, account_id 紐付け)
  // ────────────────────────────────────────────────
  console.log('  Inserting business contacts...')
  const bizContacts = await sql`
    INSERT INTO contacts (account_id, contact_type, full_name, email, phone, title) VALUES
      (${accDealerA.id}, 'business', '森田 隆',  'morita@automart-sakura.example.com', '03-1234-5678', '営業部長'),
      (${accLeasing.id}, 'business', '岡田 真理','okada@mirai-lease.example.com',     '03-5555-1212', 'フリート管理'),
      (${accPartsCo.id}, 'business', '清水 光',  'shimizu@np-shoji.example.com',      '06-7654-3210', '関東営業所長')
    RETURNING id, full_name
  `

  // ────────────────────────────────────────────────
  // 車両 (vehicles)
  // ────────────────────────────────────────────────
  console.log('  Inserting vehicles...')
  const vehs = await sql`
    INSERT INTO vehicles (
      maker, model, year, mileage, color, license_plate, vin, status,
      purchase_date, purchase_price, supplier_account_id,
      sale_price, sold_date, sold_price, buyer_account_id,
      next_inspection_date, description, owner_id
    ) VALUES
      ('トヨタ',    'アルファード',     2020,  45000, 'パールホワイト',     '品川 300 あ 12-34', 'AGH30-0123456', '販売済',
        ${dateOffset(-90)}, 2400000, ${accDealerA.id},
        3200000, ${dateOffset(-30)}, 3150000, NULL,
        ${dateOffset(540)},  'ワンオーナー、整備記録簿あり', ${OWNER_UID}),

      ('ホンダ',    'N-BOX',           2022,  18000, 'プレミアムサンライトホワイト・パール', '世田谷 580 あ 23-45', 'JF3-0234567', '在庫',
        ${dateOffset(-45)}, 1100000, ${accDealerB.id},
        1450000, NULL, NULL, NULL,
        ${dateOffset(720)}, '禁煙車、ドライブレコーダー付', ${OWNER_UID}),

      ('スズキ',    'ハスラー',         2021,  32000, 'ピュアホワイトパール',  '品川 502 う 34-56', 'MR52S-345678',   '修理中',
        ${dateOffset(-365)}, 1300000, ${accDealerA.id},
        NULL, NULL, NULL, NULL,
        ${dateOffset(180)},  '左フロント板金中（事故車）', ${OWNER_UID}),

      ('日産',      'セレナ',           2019,  62000, 'ブリリアントホワイトパール', '湘南 300 え 45-67', 'C27-0456789',   '在庫',
        ${dateOffset(-60)}, 1600000, ${accDealerB.id},
        2050000, NULL, NULL, NULL,
        ${dateOffset(60)},   'プロパイロット装備', ${OWNER_UID}),

      ('トヨタ',    'プリウス',         2018,  85000, 'シルバーメタリック',   '横浜 502 か 56-78', 'ZVW50-0567890',  '車検中',
        ${dateOffset(-540)}, 1100000, ${accDealerA.id},
        1500000, ${dateOffset(-300)}, 1480000, NULL,
        ${dateOffset(20)},   '個人ユーザの定期車検', ${OWNER_UID}),

      ('マツダ',    'CX-5',             2021,  41000, 'ソウルレッドクリスタルメタリック', '練馬 300 さ 67-89', 'KF2P-0678901',   '在庫',
        ${dateOffset(-15)}, 2500000, ${accDealerB.id},
        3100000, NULL, NULL, NULL,
        ${dateOffset(450)}, 'ディーゼル', ${OWNER_UID}),

      ('スバル',    'インプレッサ',     2020,  55000, 'クリスタルホワイトパール', '湘南 502 た 78-90', 'GT3-0789012',    'メンテ中',
        ${dateOffset(-700)}, 1800000, ${accDealerA.id},
        2200000, ${dateOffset(-450)}, 2180000, NULL,
        ${dateOffset(-10)},  'リピーター・1年点検中', ${OWNER_UID}),

      ('ダイハツ',  'タント',           2023,   8000, 'スプラッシュブルーメタリック', '品川 580 な 89-01', 'LA650S-890123',  '納車待ち',
        ${dateOffset(-20)}, 1250000, ${accDealerB.id},
        1620000, ${dateOffset(-3)},   1620000, NULL,
        ${dateOffset(910)}, '納車整備中、本日出庫予定', ${OWNER_UID}),

      ('レクサス',  'NX',               2021,  38000, 'ソニックチタニウム',  '世田谷 300 は 90-12', 'AGZ10-901234',   '在庫',
        ${dateOffset(-30)}, 4200000, ${accDealerA.id},
        5100000, NULL, NULL, NULL,
        ${dateOffset(540)}, '販売準備中', ${OWNER_UID}),

      ('ホンダ',    'フィット',         2017, 110000, 'プレミアムクリスタルブルー・メタリック', '川崎 502 ま 01-23', 'GK3-1012345',    '廃車',
        ${dateOffset(-1100)}, 700000, ${accDealerB.id},
        NULL, NULL, NULL, NULL,
        NULL, '走行距離過多のため廃車解体', ${OWNER_UID}),

      ('トヨタ',    'ハリアー',         2022,  22000, 'プレシャスブラックパール', '横浜 300 や 12-34', 'AXUH80-1123456', '在庫',
        ${dateOffset(-7)},  3300000, ${accDealerA.id},
        4100000, NULL, NULL, NULL,
        ${dateOffset(750)}, 'ハイブリッド・先進装備', ${OWNER_UID}),

      ('日産',      'ノート',           2020,  48000, 'ブリリアントシルバー', '湘南 580 ら 23-45', 'E13-1234567',    '在庫',
        ${dateOffset(-50)}, 1300000, ${accDealerB.id},
        1700000, NULL, NULL, NULL,
        ${dateOffset(120)}, '通勤車向け', ${OWNER_UID})
    RETURNING id, maker, model, status
  `

  const [vAlphard, vNBox, vHustler, vSerena, vPrius, vCX5, vImpreza, vTanto, vNX, /* fit */, vHarrier, vNote] = vehs

  // ────────────────────────────────────────────────
  // 商談 (opportunities) — 過去3ヶ月〜未来3ヶ月で 18件くらい
  // ────────────────────────────────────────────────
  console.log('  Inserting opportunities...')
  const opps = await sql`
    INSERT INTO opportunities (
      account_id, contact_id, name, stage, amount, probability, close_date, description, owner_id,
      service_type, vehicle_id, parts_cost
    ) VALUES
      -- 過去（受注済み）
      (${accLeasing.id}, ${bizContacts[1].id}, 'みらいオートリース 法人車両 板金修理 (3月)',
        'closed_won', 280000,  100, ${dateOffset(-65)},
        '事故修理。バンパー交換含む', ${OWNER_UID}, '板金修理', NULL, 90000),
      (NULL, ${consumers[0].id}, '田中様 アルファード 売却',
        'closed_won', 3150000, 100, ${dateOffset(-30)},
        'ご成約・納車完了', ${OWNER_UID}, '車両販売', ${vAlphard.id}, 2400000),
      (NULL, ${consumers[3].id}, '鈴木様 通勤車 車検 (4月)',
        'closed_won', 92000,   100, ${dateOffset(-25)},
        '車検通過、軽整備込み', ${OWNER_UID}, '車検', NULL, 28000),
      (NULL, ${consumers[2].id}, '佐藤様 事故車板金 見積→受注',
        'closed_won', 240000,  100, ${dateOffset(-55)},
        'リアバンパー＋クォーター板金', ${OWNER_UID}, '板金修理', NULL, 60000),
      (NULL, ${consumers[5].id}, '伊藤様 タント 売却',
        'closed_won', 1620000, 100, ${dateOffset(-3)},
        '頭金30万、残金ローン', ${OWNER_UID}, '車両販売', ${vTanto.id}, 1250000),

      -- 失注
      (NULL, ${consumers[4].id}, '高橋様 ファミリーカー検討',
        'closed_lost', 2200000, 0,  ${dateOffset(-40)},
        '他店で購入決定', ${OWNER_UID}, '車両販売', NULL, 0),

      -- 受注予定（今月）
      (NULL, ${consumers[1].id}, '山田様 N-BOX 商談',
        'negotiation', 1450000, 70, ${dateOffset(15)},
        '価格交渉中', ${OWNER_UID}, '車両販売', ${vNBox.id}, 1100000),
      (${accLeasing.id}, ${bizContacts[1].id}, 'みらいオート 法人車両 月次点検 (5月)',
        'negotiation', 180000, 80, ${dateOffset(10)},
        '5台分一括点検', ${OWNER_UID}, '整備', NULL, 50000),
      (NULL, ${consumers[2].id}, '佐藤様 ハスラー 板金修理',
        'proposal', 320000, 60, ${dateOffset(20)},
        '左フロント板金中', ${OWNER_UID}, '板金修理', ${vHustler.id}, 95000),

      -- 来月以降
      (NULL, ${consumers[3].id}, '鈴木様 プリウス 車検 (6月)',
        'qualification', 110000, 50, ${dateOffset(40)},
        '次回車検 6月末', ${OWNER_UID}, '車検', ${vPrius.id}, 28000),
      (NULL, ${consumers[5].id}, '伊藤様 ハリアー 試乗→商談',
        'proposal', 4100000, 60, ${dateOffset(35)},
        '試乗予約済み', ${OWNER_UID}, '車両販売', ${vHarrier.id}, 3300000),
      (NULL, ${consumers[4].id}, '高橋様 セレナ 提案',
        'qualification', 2050000, 40, ${dateOffset(50)},
        '改めてファミリーカーで打診', ${OWNER_UID}, '車両販売', ${vSerena.id}, 1600000),
      (${accDealerB.id}, NULL, 'カーズマーケット千葉 部品仕入連動商談',
        'prospecting', 600000, 30, ${dateOffset(55)},
        '車両整備の仕入と販売の取引予定', ${OWNER_UID}, 'その他', NULL, 350000),

      -- 2ヶ月先（受注確度低い）
      (NULL, ${consumers[0].id}, '田中様 次回車検 (7月)',
        'prospecting', 95000, 30, ${dateOffset(75)},
        '前回車両売却済、次の車での車検打診', ${OWNER_UID}, '車検', NULL, 25000),
      (NULL, ${consumers[1].id}, '山田様 N-BOX 1ヶ月点検',
        'prospecting', 12000, 50, ${dateOffset(75)},
        '車両販売後の点検', ${OWNER_UID}, '整備', ${vNBox.id}, 4000),
      (${accInsurance.id}, NULL, '東京海上 事故車修理 (案件A)',
        'qualification', 480000, 60, ${dateOffset(80)},
        '保険会社経由', ${OWNER_UID}, '板金修理', NULL, 180000),

      -- 3ヶ月先
      (NULL, ${consumers[3].id}, '鈴木様 オイル交換・点検',
        'prospecting', 18000, 50, ${dateOffset(95)},
        '次回点検時期', ${OWNER_UID}, '整備', NULL, 5000),
      (${accLeasing.id}, ${bizContacts[1].id}, 'みらいオート 6月車検まとめ',
        'prospecting', 360000, 40, ${dateOffset(100)},
        '3台分まとめ車検', ${OWNER_UID}, '車検', NULL, 90000)
    RETURNING id, name
  `

  // ────────────────────────────────────────────────
  // 活動履歴 (activities)
  // ────────────────────────────────────────────────
  console.log('  Inserting activities...')
  await sql`
    INSERT INTO activities (account_id, contact_id, opportunity_id, type, subject, body, occurred_at, owner_id) VALUES
      (NULL, ${consumers[0].id}, ${opps[1].id}, 'meeting', '田中様 納車式',                  '無事納車完了、ご家族でご来店',  ${ts(-30, 14)}, ${OWNER_UID}),
      (NULL, ${consumers[1].id}, ${opps[6].id}, 'call',    '山田様 試乗予約',                '土曜10時に試乗予定',            ${ts(-2, 11)},  ${OWNER_UID}),
      (NULL, ${consumers[2].id}, ${opps[3].id}, 'meeting', '佐藤様 板金 見積打合せ',         '見積内容ご納得',                ${ts(-55, 16)}, ${OWNER_UID}),
      (NULL, ${consumers[3].id}, ${opps[2].id}, 'call',    '鈴木様 車検入庫日確認',          '4/15入庫予定',                 ${ts(-30, 9)},  ${OWNER_UID}),
      (${accLeasing.id}, ${bizContacts[1].id}, ${opps[7].id}, 'email', 'みらいオート 月次点検 御見積', '5台分の見積送付',          ${ts(-7, 17)},  ${OWNER_UID}),
      (NULL, ${consumers[5].id}, ${opps[4].id}, 'meeting', '伊藤様 タント 納車',             '本日無事納車',                  ${ts(-3, 13)},  ${OWNER_UID}),
      (NULL, ${consumers[5].id}, ${opps[10].id}, 'note',   '伊藤様 ハリアー 試乗希望メモ',   'タント納車時に話あり',          ${ts(-3, 14)},  ${OWNER_UID}),
      (${accDealerA.id}, ${bizContacts[0].id}, NULL, 'meeting', 'オートマートさくら 仕入打合せ', '次回オークション仕入相談',    ${ts(-12, 15)}, ${OWNER_UID}),
      (NULL, ${consumers[4].id}, ${opps[5].id}, 'call',    '高橋様 失注連絡',                '他店決定の連絡',                ${ts(-40, 10)}, ${OWNER_UID}),
      (NULL, ${consumers[2].id}, ${opps[8].id}, 'meeting', '佐藤様 ハスラー 入庫',           '事故車として入庫',              ${ts(-5, 9)},   ${OWNER_UID}),
      (${accInsurance.id}, NULL, ${opps[15].id}, 'email',  '東京海上 案件A 見積依頼',         '保険会社からの依頼',            ${ts(-1, 10)},  ${OWNER_UID}),
      (NULL, ${consumers[3].id}, NULL, 'note',  '鈴木様 リピーター情報',          '次回オイル交換6/15予定',          ${ts(-1, 18)},  ${OWNER_UID})
  `

  // ────────────────────────────────────────────────
  // ToDo (tasks)
  // ────────────────────────────────────────────────
  console.log('  Inserting tasks...')
  await sql`
    INSERT INTO tasks (title, due_date, done, priority, account_id, contact_id, opportunity_id) VALUES
      ('山田様 試乗準備（N-BOX 洗車・装備チェック）', ${dateOffset(2)},  FALSE, 'high',   NULL, ${consumers[1].id}, ${opps[6].id}),
      ('みらいオートへ 月次点検見積回答',              ${dateOffset(3)},  FALSE, 'high',   ${accLeasing.id}, NULL, ${opps[7].id}),
      ('佐藤様 ハスラー 部品手配 (フェンダー)',         ${dateOffset(4)},  FALSE, 'high',   NULL, ${consumers[2].id}, ${opps[8].id}),
      ('鈴木様 プリウス 車検案内発送',                 ${dateOffset(7)},  FALSE, 'medium', NULL, ${consumers[3].id}, ${opps[9].id}),
      ('伊藤様 ハリアー 試乗予約フォロー',             ${dateOffset(5)},  FALSE, 'medium', NULL, ${consumers[5].id}, ${opps[10].id}),
      ('日本パーツ商事 月次発注',                      ${dateOffset(1)},  FALSE, 'medium', ${accPartsCo.id}, NULL, NULL),
      ('東京海上 案件A 見積作成',                      ${dateOffset(2)},  FALSE, 'high',   ${accInsurance.id}, NULL, ${opps[15].id}),
      ('オークション参加（毎週金曜）',                  ${dateOffset(4)},  FALSE, 'low',    ${accDealerA.id}, NULL, NULL),
      -- 完了済み
      ('田中様 アルファード 名義変更書類完了',         ${dateOffset(-32)},TRUE,  'high',   NULL, ${consumers[0].id}, ${opps[1].id}),
      ('鈴木様 車検 4月入庫準備',                      ${dateOffset(-26)},TRUE,  'medium', NULL, ${consumers[3].id}, ${opps[2].id}),
      ('伊藤様 タント 納車整備',                       ${dateOffset(-5)}, TRUE,  'high',   NULL, ${consumers[5].id}, ${opps[4].id}),
      ('佐藤様 板金（4月分）作業完了',                 ${dateOffset(-58)},TRUE,  'high',   NULL, ${consumers[2].id}, ${opps[3].id})
  `

  // ────────────────────────────────────────────────
  // 経費 (expenses) — 部品仕入・移動費・工具など
  // ────────────────────────────────────────────────
  console.log('  Inserting expenses...')
  await sql`
    INSERT INTO expenses (title, amount, category, expense_date, account_id, opportunity_id, notes) VALUES
      ('日本パーツ商事 4月度 部品仕入',  280000, '消耗品費', ${dateOffset(-25)}, ${accPartsCo.id}, NULL, 'バンパー・フェンダー類'),
      ('オートマートさくら 仕入交通費',   8500, '交通費',   ${dateOffset(-12)}, ${accDealerA.id}, NULL, 'オークション参加'),
      ('佐藤様 板金 部品代',              60000, '消耗品費', ${dateOffset(-55)}, NULL, ${opps[3].id}, 'リアバンパー部品'),
      ('みらいオート 月次点検 出張',      6200, '交通費',   ${dateOffset(-7)},  ${accLeasing.id}, ${opps[7].id}, '法人先訪問'),
      ('工具 純正スキャンツール 校正',    32000, 'その他',   ${dateOffset(-20)}, NULL, NULL, '年次メンテ'),
      ('田中様 納車場所まで陸送',         15000, '交通費',   ${dateOffset(-30)}, NULL, ${opps[1].id}, '都内配送'),
      ('オークション会員費 (5月分)',      11000, 'その他',   ${dateOffset(-5)},  ${accDealerA.id}, NULL, NULL),
      ('5月度 部品仕入 (見込み)',         95000, '消耗品費', ${dateOffset(2)},   ${accPartsCo.id}, NULL, 'ハスラー板金用部品'),
      ('伊藤様 タント 納車陸送',          12000, '交通費',   ${dateOffset(-3)},  NULL, ${opps[4].id}, NULL),
      ('鈴木様 車検 4月分 部品代',        12000, '消耗品費', ${dateOffset(-25)}, NULL, ${opps[2].id}, 'オイル・フィルター類')
  `

  // ────────────────────────────────────────────────
  // タグ（既存の tags テーブルにいくつか）
  // ────────────────────────────────────────────────
  console.log('  Inserting tags + taggables...')
  const tags = await sql`
    INSERT INTO tags (name, color) VALUES
      ('リピーター',  '#16a34a'),
      ('ToC',        '#2563eb'),
      ('法人',        '#9333ea'),
      ('保険案件',    '#ea580c')
    RETURNING id, name
  `
  const tagMap = Object.fromEntries(tags.map((t) => [t.name, t.id]))

  // ToC 顧客と法人にそれぞれタグを貼る
  for (const c of consumers) {
    await sql`INSERT INTO taggables (tag_id, object_type, object_id) VALUES (${tagMap['ToC']}, 'contact', ${c.id})`
  }
  for (const c of [accDealerA, accDealerB, accPartsCo, accLeasing, accInsurance, accBodyChain]) {
    await sql`INSERT INTO taggables (tag_id, object_type, object_id) VALUES (${tagMap['法人']}, 'account', ${c.id})`
  }
  // リピーター
  await sql`INSERT INTO taggables (tag_id, object_type, object_id) VALUES (${tagMap['リピーター']}, 'contact', ${consumers[0].id})`
  await sql`INSERT INTO taggables (tag_id, object_type, object_id) VALUES (${tagMap['リピーター']}, 'contact', ${consumers[3].id})`
  // 保険案件
  await sql`INSERT INTO taggables (tag_id, object_type, object_id) VALUES (${tagMap['保険案件']}, 'opportunity', ${opps[15].id})`

  console.log('\n✅ Seed complete.')
  console.log(`   accounts: 6, consumer contacts: ${consumers.length}, business contacts: ${bizContacts.length}`)
  console.log(`   vehicles: ${vehs.length}, opportunities: ${opps.length}`)
  console.log('   activities/tasks/expenses も投入済み。tags 4 種類。')
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1) })
