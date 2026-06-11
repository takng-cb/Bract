'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { isAdminUser } from '@/lib/userRole'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// ─────────────────────────────────────────────
// ユーザー一覧
// ─────────────────────────────────────────────
export async function listUsers() {
  // 管理者のみ（ユーザーのメール/ロールを露出するため。Server Action 直叩き対策）
  const supabase = await createSupabaseServerClient()
  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me || !(await isAdminUser(me.id))) throw new Error('管理者権限がありません')

  return db
    .select({ id: users.id, email: users.email, role: users.role, role_id: users.role_id, created_at: users.created_at })
    .from(users)
    .orderBy(asc(users.created_at))
}

// ─────────────────────────────────────────────
// ユーザー追加
// ─────────────────────────────────────────────
export async function createUser(
  _: string | null,
  formData: FormData,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me || !(await isAdminUser(me.id))) return '管理者権限がありません'

  const email    = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const role     = (formData.get('role') as string) === 'admin' ? 'admin' : 'member'

  if (!email || !password) return 'メールアドレスとパスワードは必須です'
  if (password.length < 8) return 'パスワードは8文字以上にしてください'

  const adminClient = createSupabaseAdminClient()

  // Supabase Auth にユーザー作成
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // メール確認不要で即時有効化
  })
  if (error) {
    if (error.message.includes('already registered')) return 'このメールアドレスはすでに登録されています'
    return `ユーザー作成エラー: ${error.message}`
  }

  // Neon users テーブルにも登録
  await db.insert(users).values({ id: data.user.id, email, role }).onConflictDoNothing()

  return null  // null = success
}

// ─────────────────────────────────────────────
// ロール変更
// ─────────────────────────────────────────────
export async function updateUserRole(
  targetUserId: string,
  newRole: 'admin' | 'member',
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me || !(await isAdminUser(me.id))) return { error: '管理者権限がありません' }
  if (targetUserId === me.id) return { error: '自分自身のロールは変更できません' }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId))
  return {}
}

// ─────────────────────────────────────────────
// なりすまし開始
// ─────────────────────────────────────────────
export async function startImpersonation(
  targetUserId: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me || !(await isAdminUser(me.id))) return { error: '管理者権限がありません' }
  if (targetUserId === me.id) return { error: '自分自身にはなりすませません' }

  // 管理者の refresh_token を保存
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'セッションが取得できません' }

  const cookieStore = await cookies()
  cookieStore.set('crm_admin_session', JSON.stringify({
    refreshToken: session.refresh_token,
    adminId:      me.id,
    adminEmail:   me.email ?? '',
  }), {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 8,  // 8時間
  })

  // 対象ユーザーの Magic Link を生成
  const adminClient = createSupabaseAdminClient()
  const { data: target } = await adminClient.auth.admin.getUserById(targetUserId)
  if (!target.user?.email) return { error: 'ユーザーのメールアドレスが取得できません' }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectTo = `${appUrl}/auth/callback?next=/dashboard`

  const { data: link, error } = await adminClient.auth.admin.generateLink({
    type:    'magiclink',
    email:   target.user.email,
    options: { redirectTo },
  })
  if (error || !link?.properties?.action_link) {
    return { error: `Magic Link 生成エラー: ${error?.message ?? '不明'}` }
  }

  return { url: link.properties.action_link }
}

// ─────────────────────────────────────────────
// なりすまし終了（管理者セッションを復元）
// ─────────────────────────────────────────────
export async function stopImpersonation(): Promise<void> {
  const cookieStore = await cookies()
  const stored = cookieStore.get('crm_admin_session')?.value

  if (!stored) {
    redirect('/dashboard')
  }

  const { refreshToken } = JSON.parse(stored) as { refreshToken: string; adminId: string; adminEmail: string }

  const supabase = await createSupabaseServerClient()

  // 管理者の refresh_token でセッションを復元
  await supabase.auth.refreshSession({ refresh_token: refreshToken })

  cookieStore.delete('crm_admin_session')
  redirect('/settings')
}
