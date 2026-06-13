/**
 * 承認のテストデータ投入（REQ-0073 の動作確認用）。
 *
 * ホームの「承認待ち」セクション／クイック閲覧の承認一覧を、デモ環境で
 * 実際に表示させるための pending 承認を作る。承認者は role:admin に
 * ルーティングするので、admin（test-admin 等）でログインすれば
 * 「自分が承認すべき」に出る。
 *
 * 冪等: comment が '[seed-demo]' で始まる既存承認を削除してから入れ直す
 * （approval_decisions は FK cascade で消える）。
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
import { like, inArray, asc } from 'drizzle-orm'
import * as schema from '../src/lib/schema'
import type { ApprovalStep } from '../src/lib/approvalRules'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const SEED_TAG = '[seed-demo] 承認テストデータ'

async function main() {
  console.log('🛡️  承認テストデータを投入します…')

  // 承認者・申請者になりうるユーザーを取得
  const allUsers = await db.select({ id: schema.users.id, email: schema.users.email, role: schema.users.role }).from(schema.users)
  const admins = allUsers.filter((u) => u.role === 'admin')
  if (admins.length === 0) {
    console.error('❌ admin ユーザーがいません。先に seed-test-users などで admin を作成してください。')
    process.exit(1)
  }
  // 申請者は admin 以外を優先（mine と toDecide を分けるため）。無ければ admin。
  const requester = allUsers.find((u) => u.role !== 'admin') ?? admins[0]
  console.log(`  承認者ルート: role:admin（${admins.map((a) => a.email).join(', ')}）`)
  console.log(`  申請者: ${requester.email}`)

  // 添付する実レコード（商談・取引先）を拾う
  const [opp] = await db.select({ id: schema.opportunities.id, name: schema.opportunities.name, stage: schema.opportunities.stage })
    .from(schema.opportunities).orderBy(asc(schema.opportunities.created_at)).limit(1)
  const [acc] = await db.select({ id: schema.accounts.id, name: schema.accounts.name, status: schema.accounts.status })
    .from(schema.accounts).orderBy(asc(schema.accounts.created_at)).limit(1)

  if (!opp && !acc) {
    console.error('❌ 添付できる商談・取引先がありません。デモデータを先に投入してください。')
    process.exit(1)
  }

  // 冪等: 既存のデモ承認を削除（decisions は cascade）
  const existing = await db.select({ id: schema.approvals.id }).from(schema.approvals)
    .where(like(schema.approvals.comment, '[seed-demo]%'))
  if (existing.length > 0) {
    await db.delete(schema.approvals).where(inArray(schema.approvals.id, existing.map((r) => r.id)))
    console.log(`  既存デモ承認 ${existing.length} 件を削除`)
  }

  const oneStep: ApprovalStep[] = [{ approvers: ['role:admin'], mode: 'any' }]
  const twoStep: ApprovalStep[] = [
    { approvers: ['role:admin'], mode: 'any' },
    { approvers: ['role:admin'], mode: 'any' },
  ]

  const rows: typeof schema.approvals.$inferInsert[] = []
  if (opp) {
    rows.push({
      object_type: 'opportunities', object_id: opp.id, status: 'pending',
      requested_by: requester.id, current_step: 1, route_snapshot: oneStep,
      transition: { field: 'stage', from: opp.stage, to: 'negotiation' },
      comment: SEED_TAG,
    })
  }
  if (acc) {
    rows.push({
      object_type: 'accounts', object_id: acc.id, status: 'pending',
      requested_by: requester.id, current_step: 1, route_snapshot: twoStep,
      transition: { field: 'status', from: acc.status, to: 'inactive' },
      comment: SEED_TAG,
    })
  }

  const inserted = await db.insert(schema.approvals).values(rows).returning({ id: schema.approvals.id, object_type: schema.approvals.object_type })
  console.log(`✅ 承認待ちを ${inserted.length} 件作成しました:`)
  for (const r of inserted) console.log(`   - ${r.object_type} (${r.id.slice(0, 8)})`)
  console.log('\n👉 admin でログインして ホーム上部「承認待ち」／クイック操作→レコード閲覧→承認 を確認してください。')
  console.log('   片付けるには再実行（入れ替え）か、comment LIKE \'[seed-demo]%\' の approvals を削除してください。')
}

main().catch((e) => { console.error(e); process.exit(1) })
