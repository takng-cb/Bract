import { createClient } from '@supabase/supabase-js'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf-8')
const getEnv = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1]?.trim()

const supabaseUrl      = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey   = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const databaseUrl      = getEnv('DATABASE_URL')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})
const sql = neon(databaseUrl)

const USERS = [
  { email: 't_noguchi@manage.com',  password: 'manage2manage_bract',   role: 'admin' },
  { email: 't_noguchi@general.com', password: 'general2general_bract', role: 'viewer' },
]

for (const u of USERS) {
  // 既存ユーザー確認
  const { data: { users: existing } } = await supabase.auth.admin.listUsers()
  const alreadyExists = existing.find((e) => e.email === u.email)

  let authId
  if (alreadyExists) {
    console.log(`⚠️  ${u.email} はすでに存在します（更新のみ）`)
    authId = alreadyExists.id
  } else {
    // Auth ユーザー作成
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    })
    if (error) { console.error(`❌ ${u.email} 作成失敗:`, error.message); continue }
    authId = data.user.id
    console.log(`✅ Auth ユーザー作成: ${u.email} (${authId})`)
  }

  // CRM の users テーブルに upsert
  await sql`
    INSERT INTO users (id, email, role)
    VALUES (${authId}::uuid, ${u.email}, ${u.role})
    ON CONFLICT (id) DO UPDATE SET role = ${u.role}
  `
  console.log(`✅ CRM users テーブルに登録: ${u.email} → role=${u.role}`)
}

console.log('\n🎉 テストユーザー作成完了')
console.log('  管理者: t_noguchi@manage.com / manage2manage_bract')
console.log('  一般:   t_noguchi@general.com / general2general_bract')
