import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
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
 * 登録済みユーザーかどうか（招待制: REQ-0033）。
 *
 * 以前はサインイン時に users 行を自動作成していた（初回=admin、以降=viewer）が、
 * 「誰でも Google ログインで入れてしまう」ため廃止。ユーザー追加は
 * システム管理者（/settings/system のユーザー管理）のみが行い、
 * 初期 admin はテナント構築時に scripts/create-admin-user.ts で作成する。
 */
export async function isRegisteredUser(id: string): Promise<boolean> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
  return existing.length > 0
}
