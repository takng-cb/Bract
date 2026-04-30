import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { desc } from 'drizzle-orm'
import * as schema from '../src/lib/schema'

const sql = neon(process.env.DATABASE_URL!)
const db  = drizzle(sql, { schema })

async function seedTags() {
  console.log('🏷️  タグを投入中...')

  // タグ作成
  const tagRows = await db.insert(schema.tags).values([
    { name: 'VIP',       color: '#ef4444' },
    { name: '重点顧客',  color: '#f97316' },
    { name: '見込み高',  color: '#22c55e' },
    { name: 'フォロー中', color: '#3b82f6' },
    { name: '競合注意',  color: '#8b5cf6' },
    { name: '長期案件',  color: '#14b8a6' },
  ]).onConflictDoNothing().returning({ id: schema.tags.id, name: schema.tags.name })

  console.log(`  ✅ タグ ${tagRows.length}件作成`)

  // 全タグを取得（既存含む）
  const allTags = await db.select().from(schema.tags)
  const tagMap = new Map(allTags.map((t) => [t.name, t.id]))

  // 既存レコードを取得
  const accounts     = await db.select({ id: schema.accounts.id, name: schema.accounts.name }).from(schema.accounts).orderBy(desc(schema.accounts.created_at))
  const contacts     = await db.select({ id: schema.contacts.id }).from(schema.contacts).orderBy(desc(schema.contacts.created_at))
  const opportunities = await db.select({ id: schema.opportunities.id }).from(schema.opportunities).orderBy(desc(schema.opportunities.created_at))

  const taggables: { tag_id: string; object_type: string; object_id: string }[] = []

  // 取引先にタグ付け
  if (accounts[0]) {
    // テックイノベーション → VIP, 重点顧客
    const vip = tagMap.get('VIP')
    const key = tagMap.get('重点顧客')
    if (vip) taggables.push({ tag_id: vip, object_type: 'account', object_id: accounts[0].id })
    if (key) taggables.push({ tag_id: key, object_type: 'account', object_id: accounts[0].id })
  }
  if (accounts[1]) {
    // 東京マーケティング → フォロー中
    const f = tagMap.get('フォロー中')
    if (f) taggables.push({ tag_id: f, object_type: 'account', object_id: accounts[1].id })
  }
  if (accounts[2]) {
    // 大阪製造 → 見込み高, 長期案件
    const m = tagMap.get('見込み高')
    const l = tagMap.get('長期案件')
    if (m) taggables.push({ tag_id: m, object_type: 'account', object_id: accounts[2].id })
    if (l) taggables.push({ tag_id: l, object_type: 'account', object_id: accounts[2].id })
  }

  // 担当者にタグ付け
  if (contacts[0]) {
    const vip = tagMap.get('VIP')
    if (vip) taggables.push({ tag_id: vip, object_type: 'contact', object_id: contacts[0].id })
  }

  // 商談にタグ付け
  if (opportunities[0]) {
    const f = tagMap.get('フォロー中')
    if (f) taggables.push({ tag_id: f, object_type: 'opportunity', object_id: opportunities[0].id })
  }
  if (opportunities[2]) {
    // 大阪製造案件 → 競合注意, 長期案件
    const c = tagMap.get('競合注意')
    const l = tagMap.get('長期案件')
    if (c) taggables.push({ tag_id: c, object_type: 'opportunity', object_id: opportunities[2].id })
    if (l) taggables.push({ tag_id: l, object_type: 'opportunity', object_id: opportunities[2].id })
  }

  if (taggables.length > 0) {
    await db.insert(schema.taggables).values(taggables).onConflictDoNothing()
    console.log(`  ✅ タグ紐づけ ${taggables.length}件`)
  }

  console.log('\n🎉 タグの投入が完了しました！')
}

seedTags().catch((e) => {
  console.error('❌ エラー:', e)
  process.exit(1)
})
