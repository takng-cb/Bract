/**
 * 初期管理者ユーザーの作成（テナント構築時・運営側オペレーション。REQ-0033）
 *
 * 招待制への変更により「初回ログイン＝自動 admin」は廃止。新しいテナント（Neon）を
 * 立ち上げたら、運営側が本スクリプトで最初の admin を作成する。以降のユーザー追加は
 * その admin がアプリ内（/settings/system のユーザー管理）で行う。
 *
 * 必要な env（.env.local）:
 *   - DATABASE_URL                  … 対象テナントの Neon
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY    … Auth ユーザー作成に必要
 *
 * 使い方:
 *   npx tsx scripts/create-admin-user.ts <email> <password>
 *   # 例: npx tsx scripts/create-admin-user.ts admin@example.com 'S0me-Strong-Pass'
 *
 * 同じメールの Supabase Auth ユーザーが既に存在する場合は再利用し、users 行のみ upsert する
 * （Google で先にログイン試行して弾かれたケースの救済）。
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { eq } from 'drizzle-orm'
import * as schema from '../src/lib/schema'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const [email, password] = process.argv.slice(2)

async function main() {
  if (!email || !password) {
    console.error('使い方: npx tsx scripts/create-admin-user.ts <email> <password>')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('✗ パスワードは8文字以上にしてください')
    process.exit(1)
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const dbUrl       = process.env.DATABASE_URL
  if (!supabaseUrl || !serviceKey || !dbUrl) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL を .env.local に設定してください')
    process.exit(1)
  }

  const db = drizzle(neon(dbUrl), { schema })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  console.log(`📍 対象 DB: ${new URL(dbUrl).hostname}`)
  console.log(`👤 作成する管理者: ${email}`)

  // 1) Supabase Auth ユーザー（既存なら再利用）
  let userId: string
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) {
    if (/already (been )?registered/i.test(error.message)) {
      // 既存ユーザーを検索して再利用
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listErr) { console.error(`✗ ユーザー検索エラー: ${listErr.message}`); process.exit(1) }
      const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (!found) { console.error('✗ 既存登録と表示されたがユーザーが見つかりません'); process.exit(1) }
      userId = found.id
      console.log('ℹ Supabase Auth に既存ユーザーが居たため再利用します')
    } else {
      console.error(`✗ Auth ユーザー作成エラー: ${error.message}`)
      process.exit(1)
    }
  } else {
    userId = created.user.id
    console.log('✓ Supabase Auth ユーザーを作成しました')
  }

  // 2) users 行（admin）を upsert
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId))
  if (existing.length > 0) {
    await db.update(schema.users).set({ role: 'admin', email }).where(eq(schema.users.id, userId))
    console.log('✓ users 行を admin に更新しました')
  } else {
    await db.insert(schema.users).values({ id: userId, email, role: 'admin' })
    console.log('✓ users 行（admin）を作成しました')
  }

  // 3) RBAC: role_id も admin の system ロールに紐づけ（roles 未 seed でも失敗にしない）
  try {
    const adminRole = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.name, 'admin'))
    if (adminRole.length > 0) {
      await db.update(schema.users).set({ role_id: adminRole[0].id }).where(eq(schema.users.id, userId))
      console.log('✓ RBAC: admin ロールを割当ました')
    }
  } catch { /* roles 未作成（migration 前）は無視 */ }

  console.log('\n✅ 完了。この管理者でログインし、以降のユーザーは「システム設定 → ユーザー管理」から追加してください。')
}

main().catch((e) => { console.error(e); process.exit(1) })
