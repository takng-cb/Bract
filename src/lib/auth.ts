import { cache } from 'react'
import { createSupabaseServerClient } from './supabase-server'
import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import type { Role } from './userRole'

/** 現在のログインユーザーのロールを返す（リクエスト内でキャッシュ） */
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

/** 編集可能かどうか（admin または editor） */
export async function canEdit(): Promise<boolean> {
  const role = await getCurrentRole()
  return role === 'admin' || role === 'editor'
}

/** 管理者かどうか */
export async function isAdmin(): Promise<boolean> {
  return (await getCurrentRole()) === 'admin'
}

/** 編集権限がなければ例外を投げる（Server Action 保護用） */
export async function requireEditor(): Promise<void> {
  if (!(await canEdit())) {
    throw new Error('編集権限がありません（閲覧者は変更できません）')
  }
}

/** 管理者権限がなければ例外を投げる */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error('管理者権限が必要です')
  }
}
