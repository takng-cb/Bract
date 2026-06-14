/**
 * 承認のテストデータ投入（REQ-0073 の動作確認用・新形式）。
 *
 * ねらい:
 *   - ホームの「承認待ち」／クイック閲覧の承認一覧を、admin ログインで実際に表示させる。
 *   - ただし **実レコードをロックしない**。専用のデモ用レコード（名前に【承認デモ】を付与・
 *     created_at/updated_at を過去日にして一覧の先頭に出ないようにする）を作り、それに
 *     pending 承認を付ける。これで E2E（一覧先頭レコードを編集テストに使う）とも衝突しない。
 *
 * 冪等: 既存のデモ承認（comment '[seed-demo]%'）とデモ用レコード（名前 '【承認デモ】%'）を
 *       削除してから入れ直す。
 *
 * 実行（dev の .env.local を読む）:
 *   npx tsx scripts/seed-approval-demo.ts
 *
 * ⚠ DATABASE_URL が指す DB に書き込む。必ず dev（autumn-king）で実行すること。
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { like, inArray } from 'drizzle-orm'
import * as schema from '../src/lib/schema'
import type { ApprovalStep } from '../src/lib/approvalRules'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const SEED_TAG = '[seed-demo]'
const DEMO_PREFIX = '【承認デモ】'
// 一覧（created_at desc）の先頭に出ないよう過去日で作る
const BACKDATE = new Date('2024-01-01T00:00:00Z')

async function main() {
  console.log('🛡️  承認テストデータ（新形式・専用デモレコード）を投入します…')

  const allUsers = await db.select({ id: schema.users.id, email: schema.users.email, role: schema.users.role }).from(schema.users)
  const admins = allUsers.filter((u) => u.role === 'admin')
  if (admins.length === 0) {
    console.error('❌ admin ユーザーがいません。先に seed-test-users で admin を作成してください。')
    process.exit(1)
  }
  const requester = allUsers.find((u) => u.role !== 'admin') ?? admins[0]

  // ── 冪等クリーンアップ: 旧デモ承認 → 旧デモレコード ─────────────
  const oldApprovals = await db.select({ id: schema.approvals.id }).from(schema.approvals)
    .where(like(schema.approvals.comment, `${SEED_TAG}%`))
  if (oldApprovals.length > 0) {
    await db.delete(schema.approvals).where(inArray(schema.approvals.id, oldApprovals.map((r) => r.id)))
    console.log(`  既存デモ承認 ${oldApprovals.length} 件を削除`)
  }
  const oldOpps = await db.select({ id: schema.opportunities.id }).from(schema.opportunities)
    .where(like(schema.opportunities.name, `${DEMO_PREFIX}%`))
  if (oldOpps.length > 0) {
    await db.delete(schema.opportunities).where(inArray(schema.opportunities.id, oldOpps.map((r) => r.id)))
    console.log(`  既存デモ商談 ${oldOpps.length} 件を削除`)
  }
  const oldAccs = await db.select({ id: schema.accounts.id }).from(schema.accounts)
    .where(like(schema.accounts.name, `${DEMO_PREFIX}%`))
  if (oldAccs.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, oldAccs.map((r) => r.id)))
    console.log(`  既存デモ取引先 ${oldAccs.length} 件を削除`)
  }

  // ── 専用デモレコードを作成（過去日） ─────────────────────────
  const [demoAcc] = await db.insert(schema.accounts).values({
    name: `${DEMO_PREFIX}承認サンプル商事`, status: 'active', industry: 'デモ',
    created_at: BACKDATE, updated_at: BACKDATE,
  }).returning({ id: schema.accounts.id })

  const [demoOpp] = await db.insert(schema.opportunities).values({
    name: `${DEMO_PREFIX}新システム導入提案`, account_id: demoAcc.id, stage: 'proposal',
    amount: '1200000', created_at: BACKDATE, updated_at: BACKDATE,
  }).returning({ id: schema.opportunities.id })

  // ── pending 承認を作成（承認者=role:admin） ─────────────────
  const oneStep: ApprovalStep[] = [{ approvers: ['role:admin'], mode: 'any' }]
  const twoStep: ApprovalStep[] = [
    { approvers: ['role:admin'], mode: 'any' },
    { approvers: ['role:admin'], mode: 'any' },
  ]

  const inserted = await db.insert(schema.approvals).values([
    {
      object_type: 'opportunities', object_id: demoOpp.id, status: 'pending',
      requested_by: requester.id, current_step: 1, route_snapshot: oneStep,
      transition: { field: 'stage', from: 'proposal', to: 'negotiation' },
      comment: `${SEED_TAG} 商談ステージ承認（1段階）`,
    },
    {
      object_type: 'accounts', object_id: demoAcc.id, status: 'pending',
      requested_by: requester.id, current_step: 1, route_snapshot: twoStep,
      transition: { field: 'status', from: 'active', to: 'inactive' },
      comment: `${SEED_TAG} 取引先ステータス承認（2段階）`,
    },
  ]).returning({ id: schema.approvals.id, object_type: schema.approvals.object_type })

  console.log(`✅ 承認待ちを ${inserted.length} 件作成（専用デモレコードに付与・申請者: ${requester.email}）:`)
  for (const r of inserted) console.log(`   - ${r.object_type} (${r.id.slice(0, 8)})`)
  console.log('\n👉 admin でログインして ホーム上部「承認待ち」／クイック操作→レコード閲覧→承認 を確認。')
  console.log('   実レコードはロックされません（デモ専用レコードのみ）。再実行で入れ替え、片付けは下記で:')
  console.log(`   approvals: comment LIKE '${SEED_TAG}%' / records: name LIKE '${DEMO_PREFIX}%' を削除`)
}

main().catch((e) => { console.error(e); process.exit(1) })
