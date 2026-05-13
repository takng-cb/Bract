import { db } from './db'
import { users } from './schema'
import { eq, count } from 'drizzle-orm'
import { canEditRole, isAdminRole, type Role } from './role'

// 純粋判定関数は './role' に分離。Vitest が DB を呼ばずにテストできるよう
// するため。互換性のためここから re-export して既存 import を維持。
export { canEditRole, isAdminRole, type Role }

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
  return isAdminRole(await getDbRole(userId))
}

/** 編集可能かどうか（admin または editor） */
export async function canEditUser(userId: string): Promise<boolean> {
  return canEditRole(await getDbRole(userId))
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
