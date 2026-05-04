import { db } from './db'
import { users } from './schema'
import { eq, count } from 'drizzle-orm'

export type Role = 'admin' | 'editor' | 'viewer'

/** ユーザーの DB ロールを返す（未登録なら null）*/
export async function getDbRole(userId: string): Promise<Role | null> {
  const row = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0] ?? null)
  return (row?.role as Role) ?? null
}

/** admin かどうか */
export async function isAdminUser(userId: string): Promise<boolean> {
  return (await getDbRole(userId)) === 'admin'
}

/** 編集可能かどうか（admin または editor） */
export async function canEditUser(userId: string): Promise<boolean> {
  const role = await getDbRole(userId)
  return role === 'admin' || role === 'editor'
}

/**
 * サインイン時にユーザーレコードを自動プロビジョニング。
 * - 初めてのユーザー（users テーブルが空）→ role = 'admin'
 * - 2人目以降 → role = 'viewer'
 * - 既存レコードがある場合は何もしない
 */
export async function provisionUser(id: string, email: string): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))

  if (existing.length > 0) return  // 既に登録済み

  const [{ total }] = await db.select({ total: count() }).from(users)
  const role: Role = total === 0 ? 'admin' : 'viewer'

  await db.insert(users).values({ id, email, role })
}
