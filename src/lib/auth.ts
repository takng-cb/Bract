import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './supabase-server'
import { cookies } from 'next/headers'
import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import type { Role } from './userRole'

/** 現在のログインユーザーのロールを返す（リクエスト内でキャッシュ）
 *  なりすまし中は対象ユーザーのロールを返す（Supabaseセッションが切り替わっているため自動的に正しい）
 */
export const getCurrentRole = cache(async (): Promise<Role> => {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
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
