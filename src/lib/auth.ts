import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './supabase-server'
import { cookies } from 'next/headers'
import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { canEditRole, isAdminRole, type Role } from './userRole'

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

/** ユーザーIDからロールを取得（サーバー横断キャッシュ、60秒TTL）
 *  ロール変更は最大60秒後に反映される。管理画面でロール更新時は revalidateTag する。
 */
const _getRoleById = unstable_cache(
  async (userId: string): Promise<Role> => {
    const row = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .then((r) => r[0] ?? null)
    return (row?.role as Role) ?? 'viewer'
  },
  ['user_role'],
  { tags: ['user_role'], revalidate: 60 },
)

/** 現在のログインユーザーのロールを返す（リクエスト内でキャッシュ）
 *  なりすまし中は対象ユーザーのロールを返す（Supabaseセッションが切り替わっているため自動的に正しい）
 */
export const getCurrentRole = cache(async (): Promise<Role> => {
  const user = await getSupabaseUser()
  if (!user) return 'viewer'
  return _getRoleById(user.id)
})

/** 現在なりすまし中かどうかを返す */
export async function isImpersonating(): Promise<boolean> {
  const cookieStore = await cookies()
  return !!cookieStore.get('crm_admin_session')?.value
}

/** 編集可能かどうか（admin または editor） */
export async function canEdit(): Promise<boolean> {
  return canEditRole(await getCurrentRole())
}

/** 管理者かどうか */
export async function isAdmin(): Promise<boolean> {
  return isAdminRole(await getCurrentRole())
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

/**
 * サービス提供者（運営）かどうか（REQ-0046）。
 * 各コンテナに置く運営用アカウントのメールを env `PROVIDER_EMAILS`（カンマ区切り）で指定する。
 * テナント側 DB では制御しない（テナント管理者が自分を運営に昇格できないように env 固定）。
 * env 未設定の間は移行措置として admin を運営扱いにする（本番コンテナでは必ず設定すること）。
 */
export async function isProvider(): Promise<boolean> {
  const user = await getSupabaseUser()
  if (!user?.email) return false
  const list = (process.env.PROVIDER_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (list.length === 0) return isAdmin()  // 未設定時のフォールバック（移行措置）
  return list.includes(user.email.toLowerCase())
}

/** 運営者でなければエラー（Server Action 保護用。画面側は各ページでエラーカードを出す） */
export async function requireProvider(): Promise<void> {
  if (!(await isProvider())) {
    throw new Error('この操作はサービス提供者（運営）のみ実行できます')
  }
}

/** 現在のログインユーザーのIDを返す（未ログインは null） */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await getSupabaseUser()
  return user?.id ?? null
})
