import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../src/lib/schema'

const sql = neon(process.env.DATABASE_URL!)
const db  = drizzle(sql, { schema })

async function seed() {
  console.log('🌱 テストデータを投入中...')

  // ----------------------------------------------------------------
  // 取引先
  // ----------------------------------------------------------------
  const [acc1, acc2, acc3] = await db.insert(schema.accounts).values([
    {
      name: '株式会社テックイノベーション',
      industry: 'IT・ソフトウェア',
      type: '顧客',
      phone: '03-1234-5678',
      website: 'https://tech-innovation.example.com',
      address: '東京都渋谷区神宮前1-1-1',
      annual_revenue: '500000000',
      employee_count: 120,
      status: 'active',
      description: 'SaaS製品を展開するスタートアップ。DX支援案件で継続取引中。',
    },
    {
      name: '東京マーケティング株式会社',
      industry: '広告・マーケティング',
      type: '顧客',
      phone: '03-9876-5432',
      website: 'https://tokyo-mkt.example.com',
      address: '東京都港区赤坂2-3-4',
      annual_revenue: '300000000',
      employee_count: 55,
      status: 'active',
      description: 'デジタル広告代理店。SNS運用・SEO施策で協力関係あり。',
    },
    {
      name: '大阪製造株式会社',
      industry: '製造業',
      type: '見込み客',
      phone: '06-1111-2222',
      website: 'https://osaka-mfg.example.com',
      address: '大阪府大阪市北区梅田3-5-6',
      annual_revenue: '1200000000',
      employee_count: 340,
      status: 'active',
      description: '工場向け生産管理システムの導入を検討中。来期予算確定後に本格交渉予定。',
    },
  ]).returning({ id: schema.accounts.id })

  console.log('  ✅ 取引先 3件')

  // ----------------------------------------------------------------
  // 担当者
  // ----------------------------------------------------------------
  const [con1, con2, con3, con4] = await db.insert(schema.contacts).values([
    {
      account_id: acc1.id,
      full_name: '田中 健太',
      email: 'tanaka@tech-innovation.example.com',
      phone: '090-1111-2222',
      title: 'CTO',
      department: '技術開発部',
      description: '技術選定の最終意思決定者。新技術への関心が高い。',
    },
    {
      account_id: acc1.id,
      full_name: '鈴木 美咲',
      email: 'suzuki@tech-innovation.example.com',
      phone: '090-3333-4444',
      title: 'プロジェクトマネージャー',
      department: '技術開発部',
      description: '現場担当者。週次ミーティングの窓口。',
    },
    {
      account_id: acc2.id,
      full_name: '佐藤 大輔',
      email: 'sato@tokyo-mkt.example.com',
      phone: '090-5555-6666',
      title: '営業部長',
      department: '営業部',
      description: '契約・予算の承認権限あり。',
    },
    {
      account_id: acc3.id,
      full_name: '山田 洋子',
      email: 'yamada@osaka-mfg.example.com',
      phone: '090-7777-8888',
      title: '情報システム部長',
      department: '情報システム部',
      description: 'DX推進担当。上長への稟議を作成中。',
    },
  ]).returning({ id: schema.contacts.id })

  console.log('  ✅ 担当者 4件')

  // ----------------------------------------------------------------
  // 商談
  // ----------------------------------------------------------------
  const [opp1, opp2, opp3] = await db.insert(schema.opportunities).values([
    {
      account_id: acc1.id,
      name: 'テックイノベーション CRM導入支援',
      stage: 'proposal',
      amount: '3500000',
      probability: 60,
      close_date: '2026-06-30',
      description: '既存システムからの移行支援。要件定義フェーズ完了済み。提案書提出済み。',
    },
    {
      account_id: acc2.id,
      name: '東京マーケティング データ分析基盤構築',
      stage: 'negotiation',
      amount: '8000000',
      probability: 80,
      close_date: '2026-05-31',
      description: 'BIツール導入とダッシュボード構築。価格交渉中。',
    },
    {
      account_id: acc3.id,
      name: '大阪製造 生産管理システム提案',
      stage: 'qualification',
      amount: '15000000',
      probability: 30,
      close_date: '2026-09-30',
      description: '要件ヒアリング実施済み。競合2社と比較検討中。',
    },
  ]).returning({ id: schema.opportunities.id })

  console.log('  ✅ 商談 3件')

  // ----------------------------------------------------------------
  // 活動履歴
  // ----------------------------------------------------------------
  await db.insert(schema.activities).values([
    {
      account_id: acc1.id,
      opportunity_id: opp1.id,
      type: 'meeting',
      subject: '要件定義ミーティング',
      body: '現行システムの課題をヒアリング。移行データ量は約50万件。スケジュールは3ヶ月を想定。次回は提案書レビューを実施する。',
      occurred_at: new Date('2026-04-20T10:00:00'),
    },
    {
      account_id: acc2.id,
      opportunity_id: opp2.id,
      type: 'call',
      subject: '価格交渉の電話',
      body: '佐藤部長より10%値引き要求あり。社内確認の上、来週中に回答する旨を伝えた。',
      occurred_at: new Date('2026-04-25T14:30:00'),
    },
    {
      account_id: acc3.id,
      opportunity_id: opp3.id,
      type: 'email',
      subject: '提案資料の送付',
      body: '要件ヒアリング結果に基づいた提案書を送付。競合との差別化ポイントとしてサポート体制を強調した。',
      occurred_at: new Date('2026-04-22T09:00:00'),
    },
    {
      account_id: acc1.id,
      type: 'note',
      subject: '展示会での接触メモ',
      body: 'IT-EXPOにて田中CTOと名刺交換。次世代開発環境に興味あり。後日デモのアポを取ること。',
      occurred_at: new Date('2026-04-15T16:00:00'),
    },
  ])

  console.log('  ✅ 活動履歴 4件')

  // ----------------------------------------------------------------
  // activity_contacts の紐づけ
  // ----------------------------------------------------------------
  const activityRows = await db.select({ id: schema.activities.id })
    .from(schema.activities)
    .orderBy(schema.activities.occurred_at)

  if (activityRows.length >= 1) {
    await db.insert(schema.activity_contacts).values([
      { activity_id: activityRows[0].id, contact_id: con1.id },
      { activity_id: activityRows[0].id, contact_id: con2.id },
    ]).onConflictDoNothing()
  }

  // ----------------------------------------------------------------
  // ToDo
  // ----------------------------------------------------------------
  await db.insert(schema.tasks).values([
    {
      title: '提案書レビューのフォローアップ',
      priority: 'high',
      due_date: '2026-05-07',
      done: false,
      account_id: acc1.id,
      contact_id: con1.id,
      opportunity_id: opp1.id,
    },
    {
      title: '価格交渉の回答を送付',
      priority: 'high',
      due_date: '2026-05-02',
      done: false,
      account_id: acc2.id,
      contact_id: con3.id,
      opportunity_id: opp2.id,
    },
    {
      title: '大阪製造への競合比較資料を作成',
      priority: 'medium',
      due_date: '2026-05-15',
      done: false,
      account_id: acc3.id,
      contact_id: con4.id,
    },
    {
      title: '月次営業レポートの作成',
      priority: 'low',
      due_date: '2026-04-30',
      done: true,
    },
  ])

  console.log('  ✅ ToDo 4件')

  // ----------------------------------------------------------------
  // 経費
  // ----------------------------------------------------------------
  await db.insert(schema.expenses).values([
    {
      title: 'テックイノベーション訪問 交通費',
      amount: '2840',
      category: '交通費',
      expense_date: '2026-04-20',
      account_id: acc1.id,
      notes: '往復 新宿〜渋谷',
    },
    {
      title: '佐藤部長との会食',
      amount: '18500',
      category: '接待費',
      expense_date: '2026-04-25',
      account_id: acc2.id,
      contact_id: con3.id,
      opportunity_id: opp2.id,
      notes: '価格交渉前の関係構築。2名。',
    },
    {
      title: 'IT-EXPO 展示会参加費',
      amount: '30000',
      category: '広告費',
      expense_date: '2026-04-15',
      notes: '業界展示会への出展費用',
    },
  ])

  console.log('  ✅ 経費 3件')
  console.log('\n🎉 テストデータの投入が完了しました！')
}

seed().catch((e) => {
  console.error('❌ エラーが発生しました:', e)
  process.exit(1)
})
