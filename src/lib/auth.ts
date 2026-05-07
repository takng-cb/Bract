import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './supabase-server'
import { cookies } from 'next/headers'
import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import type { Role } from './userRole'

/**
 * リクエストごとに一度だけ Supabase Auth を呼ぶ共有キャッシュ関数。
 * getUser() は認証サーバーへのネットワーク呼び出しになるため、
 * React の cache() でリクエスト内の重複呼び出しを防ぐ。
 * layout.tsx など複数箇所から import して使うことで auth 呼び出しを1回に抑える。
 */
export const getSupabaseUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/** 現在のログインユーザーのロールを返す（リクエスト内でキャッシュ）
 *  なりすまし中は対象ユーザーのロールを返す（Supabaseセッションが切り替わっているため自動的に正しい）
 */
export const getCurrentRole = cache(async (): Promise<Role> => {
  const user = await getSupabaseUser()
  if (!user) return 'viewer'

  const row = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .then((r) => r[0] ?? null)

  return (row?.role as Role) ?? 'viewer'
})

/** 現在なりすまし中かどうかを返す */
export async function isImpersonating(): Promise<boolean> {
  const cookieStore = await cookies()
  return !!cookieStore.get('crm_admin_session')?.value
}

/** 編集可能かどうか（admin または editor） */
export async function canEdit(): Promise<boolean> {
  const role = await getCurrentRole()
  return role === 'admin' || role === 'editor'
}

/** 管理者かどうか */
export async function isAdmin(): Promise<boolean> {
  return (await getCurrentRole()) === 'admin'
}

/** 編集権限がなければダッシュボードへリダイレクト（Server Action 保護用は例外を投げる） */
export async function requireEditor(): Promise<void> {
  if (!(await canEdit())) {
    redirect('/dashboard')
  }
}

/** 管理者権限がなければダッシュボードへリダイレクト */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect('/dashboard')
  }
}

/** 現在のログインユーザーのIDを返す（未ログインは null） */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await getSupabaseUser()
  return user?.id ?? null
})
