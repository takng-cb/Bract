/**
 * 外部ユーザー共有の「正の経路」E2E 用 seed（REQ-0084 / Phase2）。
 *
 * test-external@bract-crm.local（is_external=true、seed-test-users で投入済み）に対し、
 * マーカー名の取引先（account）を find-or-create して record_grant を1件付与する。
 * これにより /portal にその取引先が表示され、詳細が閲覧できることを E2E で検証できる。
 *
 * 冪等: 取引先もグラントも存在すれば再利用（重複作成しない）。
 *
 * 実行:
 *   npx tsx scripts/seed-external-grant.ts            # DATABASE_URL は .env.local から
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ DATABASE_URL 未設定（.env.local を確認）')
  process.exit(1)
}

const EXTERNAL_EMAIL = 'test-external@bract-crm.local'
const MARKER_NAME = 'E2E共有テスト取引先'

const sql = neon(databaseUrl)
const dbHost = databaseUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown'

async function main() {
  console.log(`📍 Neon ホスト: ${dbHost}`)

  // 1) 外部ユーザー
  const userRows = await sql`SELECT id FROM users WHERE email = ${EXTERNAL_EMAIL} AND is_external = true LIMIT 1` as { id: string }[]
  if (userRows.length === 0) {
    console.error(`❌ ${EXTERNAL_EMAIL}（is_external=true）が見つかりません。先に seed-test-users を実行してください。`)
    process.exit(1)
  }
  const granteeId = userRows[0].id

  // 2) マーカー取引先を find-or-create
  const existing = await sql`SELECT id FROM accounts WHERE name = ${MARKER_NAME} LIMIT 1` as { id: string }[]
  let accountId: string
  if (existing.length > 0) {
    accountId = existing[0].id
  } else {
    const created = await sql`INSERT INTO accounts (name, status) VALUES (${MARKER_NAME}, 'active') RETURNING id` as { id: string }[]
    accountId = created[0].id
  }

  // 3) grant を付与（冪等）
  await sql`
    INSERT INTO record_grants (object_api, record_id, grantee_id, level)
    VALUES ('account', ${accountId}::uuid, ${granteeId}::uuid, 'read')
    ON CONFLICT (object_api, record_id, grantee_id) DO NOTHING
  `

  console.log('✅ 付与完了')
  console.log(`   account "${MARKER_NAME}" id=${accountId}`)
  console.log(`   → grantee ${EXTERNAL_EMAIL} (${granteeId})`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1) })
