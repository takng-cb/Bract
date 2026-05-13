/**
 * Playwright E2E / 手動テスト用のテストユーザーを Supabase Auth と
 * 対象 Neon の users テーブルに投入する seed スクリプト。
 *
 * Issue #40 (リリース前 機能テスト計画) Sprint 1-1 で導入。
 *
 * 投入する 3 ユーザー（業種に依存しない共通テスト ID）:
 *   - test-admin@bract-crm.local   → role: admin
 *   - test-editor@bract-crm.local  → role: editor
 *   - test-viewer@bract-crm.local  → role: viewer
 *
 * 業種別の権限テストをするには、`.env.local` の DATABASE_URL を業種別 Neon
 * に切り替えて本スクリプトを再実行する。Supabase Auth は global なので
 * 1 回作れば 3 業種で同じ user_id が共有される。
 *
 * 環境変数:
 *   TEST_USER_PASSWORD       (任意): 3 ユーザー共通のパスワード。
 *                                    未指定なら ランダム生成して stdout に表示。
 *   DATABASE_URL             (必須): 対象 Neon の接続文字列（.env.local から自動読込）
 *   NEXT_PUBLIC_SUPABASE_URL (必須)
 *   SUPABASE_SERVICE_ROLE_KEY(必須)
 *
 * 実行:
 *   TEST_USER_PASSWORD=Test_Bract_2026  npx tsx scripts/seed-test-users.ts
 *   npx tsx scripts/seed-test-users.ts             # ランダムパスワード生成
 *
 * 終了コード: 0 成功 / 1 失敗
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { neon } from '@neondatabase/serverless'
import { randomBytes } from 'node:crypto'

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const databaseUrl    = process.env.DATABASE_URL

if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  console.error('❌ 必須 env 未設定: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL')
  process.exit(1)
}

const password = process.env.TEST_USER_PASSWORD ?? `Test_${randomBytes(8).toString('hex')}`
const passwordWasGenerated = !process.env.TEST_USER_PASSWORD

const TEST_USERS = [
  { email: 'test-admin@bract-crm.local',  role: 'admin'  as const },
  { email: 'test-editor@bract-crm.local', role: 'editor' as const },
  { email: 'test-viewer@bract-crm.local', role: 'viewer' as const },
]

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const sql = neon(databaseUrl)

// 対象 Neon ホストを表示（業種取り違え防止）
const dbHost = databaseUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown'

async function main() {
  console.log(`📍 Neon ホスト: ${dbHost}`)
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`)

  // 既存 Auth ユーザー一覧
  const { data: { users: existing }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('❌ Supabase listUsers 失敗:', listError.message)
    process.exit(1)
  }
  const existingByEmail = new Map(existing.map((u) => [u.email, u]))

  const results: { email: string; role: string; created: boolean; authId: string }[] = []

  for (const { email, role } of TEST_USERS) {
    const found = existingByEmail.get(email)
    let authId: string
    let created = false

    if (found) {
      authId = found.id
      // パスワードを上書き（既存ユーザーでも新しい TEST_USER_PASSWORD を反映）
      const { error: updateError } = await supabase.auth.admin.updateUserById(authId, { password })
      if (updateError) {
        console.error(`⚠ ${email}: パスワード更新失敗 (${updateError.message})、続行`)
      }
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (error || !data.user) {
        console.error(`❌ ${email} 作成失敗: ${error?.message}`)
        continue
      }
      authId = data.user.id
      created = true
    }

    // 対象 Neon の users テーブルに upsert
    await sql`
      INSERT INTO users (id, email, role)
      VALUES (${authId}::uuid, ${email}, ${role})
      ON CONFLICT (id) DO UPDATE SET role = ${role}, email = ${email}
    `
    results.push({ email, role, created, authId })
  }

  console.log('\n結果:')
  for (const r of results) {
    const tag = r.created ? '✅ CREATE' : '🔄 UPDATE'
    console.log(`  ${tag}  ${r.email.padEnd(36)} role=${r.role.padEnd(7)} authId=${r.authId}`)
  }

  console.log(`\n${results.length}/${TEST_USERS.length} ユーザー投入完了`)

  if (passwordWasGenerated) {
    console.log('\n⚠ TEST_USER_PASSWORD env が未指定だったためランダム生成しました:')
    console.log(`    ${password}`)
    console.log('  控えておいて、Playwright 等の env に登録してください。')
  } else {
    console.log('\n  TEST_USER_PASSWORD (env 経由) を使用しました。')
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
