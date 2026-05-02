/**
 * ページネーション確認用の大量テストデータ投入スクリプト
 * 各オブジェクト 22〜30件 → ページ2が生まれる件数
 *
 * 実行: npx tsx scripts/seed-bulk.ts
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../src/lib/schema'

const sql = neon(process.env.DATABASE_URL!)
const db  = drizzle(sql, { schema })

// ──────────────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

const INDUSTRIES = ['IT・ソフトウェア', '製造業', '金融・保険', '不動産', '医療・福祉', '小売業', '建設業', '物流', '広告・マーケティング', '教育']
const TYPES      = ['顧客', '見込み客', 'パートナー', '競合他社', 'その他']
const STAGES     = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const ACT_TYPES  = ['call', 'email', 'meeting', 'note']
const PRIORITIES = ['high', 'medium', 'low']
const CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']
const PROP_TYPES = ['マンション', '戸建て', '土地', 'ビル', '店舗', '倉庫', 'その他']
const PROP_STAT  = ['募集中', '交渉中', '成約', '管理中', '終了']
const TX_TYPES   = ['売買', '賃貸']
const TITLES     = ['代表取締役', 'CTO', '営業部長', '情報システム部長', 'プロジェクトマネージャー', 'マーケティング部長', '購買部長', '経理部長', '企画部長', '技術課長']
const DEPTS      = ['営業部', '技術開発部', '情報システム部', '経営企画部', 'マーケティング部', '購買部', '経理部', '人事部']
const PREFECTURES = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '宮城県', '広島県', '京都府', '兵庫県']

const COMPANY_PREFIXES   = ['株式会社', '合同会社', '有限会社']
const COMPANY_NAMES      = ['テックソリューションズ', 'グローバルシステム', 'フューチャーワークス', 'イノベーションラボ', 'デジタルフロンティア', 'スマートビジネス', 'プログレスIT', 'クラウドテック', 'データドリブン', 'ネクストジェネレーション', 'アドバンストシステム', 'ユニファイド', 'コアシステム', 'リーディングエッジ', 'スケールアップ', 'テックブリッジ', 'サイバーリンク', 'インテグレート', 'モダンソリューション', 'トランスフォーム', 'エンタープライズ', 'ブレイクスルー', 'ビジョナリー']
const FAMILY_NAMES       = ['田中', '山田', '鈴木', '佐藤', '高橋', '伊藤', '渡辺', '中村', '小林', '加藤', '吉田', '松本', '井上', '木村', '林', '斎藤', '清水', '山口', '池田', '橋本', '岡田', '長谷川', '石井', '森', '三浦']
const GIVEN_NAMES        = ['健太', '美咲', '大輔', '洋子', '拓也', '由美', '誠', '幸子', '雄大', '明日香', '翔太', '真由美', '浩二', '恵子', '啓介', '智子', '和也', '優子', '達也', '裕美']
const OPP_VERBS          = ['CRM導入', 'システム刷新', 'クラウド移行', 'DX推進支援', 'データ分析基盤構築', 'セキュリティ強化', 'BPR支援', 'ERP導入', '業務自動化', 'AI活用推進']
const ACT_SUBJECTS       = ['初回訪問', '提案書レビュー', '価格交渉', '要件定義MTG', 'デモ実施', '見積もり提出', '契約書確認', 'キックオフMTG', '進捗報告', 'フォローアップ']
const TASK_TITLES        = ['提案書を作成', '見積もりを送付', 'フォローアップ電話', 'アポイント設定', '議事録を作成', '資料を更新', '承認依頼を送付', '競合調査', '社内稟議を通す', 'デモ環境を準備']
const PROP_NAMES_PREFIX  = ['アーバン', 'グランド', 'ロイヤル', 'セントラル', 'プレミアム', 'レジデンス', 'ハイツ', 'パーク', 'ビュー', 'タワー', 'コート', 'ガーデン']
const PROP_NAMES_AREA    = ['渋谷', '新宿', '銀座', '品川', '六本木', '恵比寿', '代々木', '青山', '表参道', '赤坂', '梅田', '心斎橋', '難波', '天王寺', '北浜']

async function seed() {
  console.log('🌱 大量テストデータを投入中...')
  console.log('   ※既存データに追記します\n')

  // ──────────────────────────────────────────────────────────────
  // 取引先 25件
  // ──────────────────────────────────────────────────────────────
  const accountValues = Array.from({ length: 25 }, (_, i) => ({
    name:           `${pick(COMPANY_PREFIXES)}${COMPANY_NAMES[i % COMPANY_NAMES.length]}`,
    industry:       INDUSTRIES[i % INDUSTRIES.length],
    type:           TYPES[i % TYPES.length],
    phone:          `0${rand(3, 9)}${rand(10, 99)}-${rand(1000, 9999)}-${rand(1000, 9999)}`,
    website:        `https://example${i + 1}.co.jp`,
    address:        `${PREFECTURES[i % PREFECTURES.length]}${pick(['千代田区', '中央区', '港区', '渋谷区', '新宿区'])}${rand(1, 5)}-${rand(1, 20)}-${rand(1, 10)}`,
    annual_revenue: String(rand(50, 2000) * 1_000_000),
    employee_count: rand(10, 500),
    status:         i % 8 === 0 ? 'inactive' : 'active',
    description:    `テスト取引先 #${i + 1}。${INDUSTRIES[i % INDUSTRIES.length]}向けサービスを提供。`,
  }))

  const accRows = await db.insert(schema.accounts).values(accountValues).returning({ id: schema.accounts.id })
  const accIds  = accRows.map((r) => r.id)
  console.log(`  ✅ 取引先 ${accIds.length}件`)

  // ──────────────────────────────────────────────────────────────
  // 担当者 30件
  // ──────────────────────────────────────────────────────────────
  const contactValues = Array.from({ length: 30 }, (_, i) => ({
    account_id:  accIds[i % accIds.length],
    full_name:   `${FAMILY_NAMES[i % FAMILY_NAMES.length]} ${GIVEN_NAMES[i % GIVEN_NAMES.length]}`,
    email:       `contact${i + 1}@example${(i % accIds.length) + 1}.co.jp`,
    phone:       `090-${rand(1000, 9999)}-${rand(1000, 9999)}`,
    title:       TITLES[i % TITLES.length],
    department:  DEPTS[i % DEPTS.length],
    description: `テスト担当者 #${i + 1}`,
  }))

  const conRows = await db.insert(schema.contacts).values(contactValues).returning({ id: schema.contacts.id })
  const conIds  = conRows.map((r) => r.id)
  console.log(`  ✅ 担当者 ${conIds.length}件`)

  // ──────────────────────────────────────────────────────────────
  // 商談 25件
  // ──────────────────────────────────────────────────────────────
  const oppValues = Array.from({ length: 25 }, (_, i) => ({
    account_id:  accIds[i % accIds.length],
    name:        `${accRows[i % accIds.length] ? accountValues[i % accountValues.length].name : '取引先'} ${OPP_VERBS[i % OPP_VERBS.length]}`,
    stage:       STAGES[i % STAGES.length],
    amount:      String(rand(50, 5000) * 10_000),
    probability: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100][i % 10],
    close_date:  `2026-${String(rand(4, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
    description: `テスト商談 #${i + 1}`,
  }))

  const oppRows = await db.insert(schema.opportunities).values(oppValues).returning({ id: schema.opportunities.id })
  const oppIds  = oppRows.map((r) => r.id)
  console.log(`  ✅ 商談 ${oppIds.length}件`)

  // ──────────────────────────────────────────────────────────────
  // 活動履歴 30件
  // ──────────────────────────────────────────────────────────────
  const actValues = Array.from({ length: 30 }, (_, i) => {
    const daysAgo = rand(1, 90)
    const d       = new Date(Date.now() - daysAgo * 86_400_000)
    return {
      account_id:     accIds[i % accIds.length],
      contact_id:     conIds[i % conIds.length],
      opportunity_id: i % 3 === 0 ? oppIds[i % oppIds.length] : null,
      type:           ACT_TYPES[i % ACT_TYPES.length],
      subject:        `${ACT_SUBJECTS[i % ACT_SUBJECTS.length]}（テスト #${i + 1}）`,
      body:           `テスト活動 #${i + 1} の詳細メモです。実施日 ${d.toLocaleDateString('ja-JP')}。`,
      occurred_at:    d,
    }
  })

  await db.insert(schema.activities).values(actValues)
  console.log(`  ✅ 活動履歴 ${actValues.length}件`)

  // ──────────────────────────────────────────────────────────────
  // ToDo 25件
  // ──────────────────────────────────────────────────────────────
  const taskValues = Array.from({ length: 25 }, (_, i) => {
    const daysFromNow = rand(-5, 30)
    const d = new Date(Date.now() + daysFromNow * 86_400_000)
    return {
      title:          `${TASK_TITLES[i % TASK_TITLES.length]}（テスト #${i + 1}）`,
      priority:       PRIORITIES[i % PRIORITIES.length],
      due_date:       d.toISOString().slice(0, 10),
      done:           i % 5 === 0,
      account_id:     accIds[i % accIds.length],
      contact_id:     conIds[i % conIds.length],
      opportunity_id: i % 4 === 0 ? oppIds[i % oppIds.length] : null,
    }
  })

  await db.insert(schema.tasks).values(taskValues)
  console.log(`  ✅ ToDo ${taskValues.length}件`)

  // ──────────────────────────────────────────────────────────────
  // 経費 25件
  // ──────────────────────────────────────────────────────────────
  const expValues = Array.from({ length: 25 }, (_, i) => {
    const daysAgo = rand(1, 60)
    const d = new Date(Date.now() - daysAgo * 86_400_000)
    return {
      title:          `${CATEGORIES[i % CATEGORIES.length]} テスト #${i + 1}`,
      amount:         String(rand(1, 200) * 500),
      category:       CATEGORIES[i % CATEGORIES.length],
      expense_date:   d.toISOString().slice(0, 10),
      account_id:     i % 3 === 0 ? null : accIds[i % accIds.length],
      opportunity_id: i % 5 === 0 ? oppIds[i % oppIds.length] : null,
      notes:          `テスト経費 #${i + 1}`,
    }
  })

  await db.insert(schema.expenses).values(expValues)
  console.log(`  ✅ 経費 ${expValues.length}件`)

  // ──────────────────────────────────────────────────────────────
  // 物件・商品 22件
  // ──────────────────────────────────────────────────────────────
  const propValues = Array.from({ length: 22 }, (_, i) => ({
    name:             `${PROP_NAMES_PREFIX[i % PROP_NAMES_PREFIX.length]}${PROP_NAMES_AREA[i % PROP_NAMES_AREA.length]} ${rand(100, 999)}号`,
    property_type:    PROP_TYPES[i % PROP_TYPES.length],
    transaction_type: TX_TYPES[i % TX_TYPES.length],
    status:           PROP_STAT[i % PROP_STAT.length],
    address:          `${PREFECTURES[i % PREFECTURES.length]}${PROP_NAMES_AREA[i % PROP_NAMES_AREA.length]}${rand(1, 5)}-${rand(1, 30)}-${rand(1, 20)}`,
    area:             String(rand(20, 300)),
    price:            TX_TYPES[i % TX_TYPES.length] === '売買'
                        ? String(rand(1000, 30000) * 10_000)
                        : String(rand(5, 100) * 10_000),
    floor:            rand(1, 20),
    total_floors:     rand(2, 30),
    built_year:       rand(1980, 2024),
    account_id:       accIds[i % accIds.length],
    description:      `テスト物件 #${i + 1}`,
  }))

  await db.insert(schema.properties).values(propValues)
  console.log(`  ✅ 物件・商品 ${propValues.length}件`)

  console.log('\n🎉 大量テストデータの投入が完了しました！')
  console.log('   各リストページで2ページ目が表示されることを確認してください。')
}

seed().catch((e) => {
  console.error('❌ エラー:', e)
  process.exit(1)
})
