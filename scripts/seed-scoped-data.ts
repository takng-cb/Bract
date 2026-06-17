/**
 * 社内レコードスコープ（own）E2E 用 seed（REQ-0083）。
 *
 * 1) カスタムロール「E2E自分のみ」を作成（'*' で read/update=true、read_scope/write_scope='own'）
 * 2) test-scoped@bract-crm.local（seed-test-users で投入済み）にそのロールを割り当て
 * 3) 各ブックに own（test-scoped 所有）/ other（別 owner）レコードを固定UUIDで投入（冪等）
 *
 * 前提: 先に seed-test-users を実行（test-scoped が Supabase Auth ＋ users に存在）。
 * 実行: npx tsx scripts/seed-scoped-data.ts   # DATABASE_URL は .env.local
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { SCOPED_EMAIL, SCOPED_ROLE_NAME, OTHER_OWNER_ID, SCOPE_BOOKS } from '../tests/e2e/scope.fixtures'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) { console.error('❌ DATABASE_URL 未設定'); process.exit(1) }

const sql = neon(databaseUrl)
const dbHost = databaseUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown'

async function main() {
  console.log(`📍 Neon ホスト: ${dbHost}`)

  // 1) スコープユーザー
  const u = await sql`SELECT id FROM users WHERE email = ${SCOPED_EMAIL} AND is_external = false LIMIT 1` as { id: string }[]
  if (u.length === 0) { console.error(`❌ ${SCOPED_EMAIL} が見つかりません。先に seed-test-users を実行してください。`); process.exit(1) }
  const scopedId = u[0].id

  // 2) カスタムロール（own スコープ）を find-or-create
  const r = await sql`
    INSERT INTO roles (name, description, is_system)
    VALUES (${SCOPED_ROLE_NAME}, 'E2E: 自分の担当のみ（read/update=own）', false)
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id
  ` as { id: string }[]
  const roleId = r[0].id

  // 権限: '*' で read/update 可・スコープ own（create/delete は付けない）
  await sql`DELETE FROM role_permissions WHERE role_id = ${roleId}::uuid`
  await sql`
    INSERT INTO role_permissions (role_id, book_api, can_create, can_read, can_update, can_delete, read_scope, write_scope)
    VALUES (${roleId}::uuid, '*', false, true, true, false, 'own', 'own')
  `

  // ユーザーへ割り当て（role テキストは editor 近似）
  await sql`UPDATE users SET role_id = ${roleId}::uuid, role = 'editor' WHERE id = ${scopedId}::uuid`

  // 3) own / other レコードを固定UUIDで投入（冪等）
  for (const b of SCOPE_BOOKS) {
    const extraCols = (b.seedExtra ?? []).map((e) => e.col)
    const extraVals = (b.seedExtra ?? []).map((e) => e.value)
    const cols = ['id', b.nameCol, 'owner_id', ...extraCols]

    const insertOne = async (id: string, name: string, ownerId: string) => {
      const vals = [id, name, ownerId, ...extraVals]
      const colList = cols.join(', ')
      const placeholders = vals.map((_, i) => `$${i + 1}${i === 0 ? '::uuid' : i === 2 ? '::uuid' : ''}`).join(', ')
      // owner_id を競合時に更新（再実行で所有者を確定させる）
      const q = `INSERT INTO ${b.table} (${colList}) VALUES (${placeholders})
                 ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, ${b.nameCol} = EXCLUDED.${b.nameCol}`
      await sql.query(q, vals)
    }

    await insertOne(b.ownId, b.ownName, scopedId)
    await insertOne(b.otherId, b.otherName, OTHER_OWNER_ID)
    console.log(`  ✅ ${b.table}: own=${b.ownName} / other=${b.otherName}`)
  }

  console.log(`\n✅ スコープ seed 完了（role=${SCOPED_ROLE_NAME} → ${SCOPED_EMAIL}）`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1) })
