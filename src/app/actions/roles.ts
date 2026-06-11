'use server'

/**
 * RBAC: ロール管理の Server Actions（REQ-0031 / ADR-0023）。すべて管理者専用。
 * system ロール（admin/editor/viewer）は削除・改名・権限変更不可。
 */
import { db } from '@/lib/db'
import { roles, role_permissions, users } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth'

async function getRole(id: string) {
  return db.select().from(roles).where(eq(roles.id, id)).then((r) => r[0] ?? null)
}

/** ロール作成（権限は viewer 相当の既定からスタート） */
export async function createRole(formData: FormData): Promise<string> {
  await requireAdmin()
  const name = (formData.get('name') ?? '').toString().trim()
  const description = (formData.get('description') ?? '').toString().trim() || null
  if (!name) throw new Error('ロール名は必須です')

  const [row] = await db.insert(roles).values({ name, description }).returning({ id: roles.id })
  // 既定: 全ブック Read のみ（ワイルドカード）
  await db.insert(role_permissions).values({
    role_id: row.id, book_api: '*', can_create: false, can_read: true, can_update: false, can_delete: false,
  }).onConflictDoNothing()
  revalidatePath('/admin/roles')
  return row.id
}

/** ロールの名前・説明を更新（system ロールは不可） */
export async function updateRole(id: string, formData: FormData): Promise<void> {
  await requireAdmin()
  const role = await getRole(id)
  if (!role) throw new Error('ロールが見つかりません')
  if (role.is_system) throw new Error('システムロールは編集できません')
  const name = (formData.get('name') ?? '').toString().trim()
  const description = (formData.get('description') ?? '').toString().trim() || null
  if (!name) throw new Error('ロール名は必須です')
  await db.update(roles).set({ name, description, updated_at: new Date() }).where(eq(roles.id, id))
  revalidatePath('/admin/roles')
}

/** ロール削除（system ロール不可。割当ユーザーは role_id=NULL に戻る＝旧テキストロールへフォールバック） */
export async function deleteRole(id: string): Promise<void> {
  await requireAdmin()
  const role = await getRole(id)
  if (!role) return
  if (role.is_system) throw new Error('システムロールは削除できません')
  await db.delete(roles).where(eq(roles.id, id))
  revalidateTag('user_role', 'max')
  revalidatePath('/admin/roles')
}

/**
 * 権限マトリクスの一括保存。
 * rows は JSON: [{ book_api, can_create, can_read, can_update, can_delete }, ...]
 * '*' 行は既定として常に保持する。
 */
export async function saveRolePermissions(roleId: string, formData: FormData): Promise<void> {
  await requireAdmin()
  const role = await getRole(roleId)
  if (!role) throw new Error('ロールが見つかりません')
  if (role.is_system) throw new Error('システムロールの権限は固定です')

  const raw = (formData.get('permissions') ?? '[]').toString()
  let rows: { book_api: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }[]
  try {
    rows = JSON.parse(raw)
  } catch {
    throw new Error('権限データの形式が不正です')
  }

  // 全行入れ替え（ロール単位の行数は少ないので素朴に delete→insert）
  await db.delete(role_permissions).where(eq(role_permissions.role_id, roleId))
  const values = rows
    .filter((r) => typeof r.book_api === 'string' && r.book_api.trim() !== '')
    .map((r) => ({
      role_id: roleId,
      book_api: r.book_api.trim(),
      can_create: !!r.can_create,
      can_read: !!r.can_read,
      can_update: !!r.can_update,
      can_delete: !!r.can_delete,
    }))
  if (values.length > 0) await db.insert(role_permissions).values(values).onConflictDoNothing()
  revalidatePath('/admin/roles')
}

/**
 * ユーザーへのロール割当。
 * - system ロール → users.role テキストも同名に同期（既存の admin 判定・canEdit と整合）
 * - カスタムロール → users.role はワイルドカード/個別の書き込み可否から近似
 *   （editor=どこかに書き込み権あり / viewer=読み取りのみ）。実際の強制は requirePermission が行う。
 */
export async function assignUserRole(userId: string, roleId: string): Promise<void> {
  await requireAdmin()
  const role = await getRole(roleId)
  if (!role) throw new Error('ロールが見つかりません')

  let roleText: string
  if (role.is_system) {
    roleText = role.name
  } else {
    const perms = await db.select().from(role_permissions).where(eq(role_permissions.role_id, roleId))
    const hasWrite = perms.some((p) => p.can_create || p.can_update || p.can_delete)
    roleText = hasWrite ? 'editor' : 'viewer'
  }

  await db.update(users).set({ role_id: roleId, role: roleText }).where(eq(users.id, userId))
  revalidateTag('user_role', 'max')
  revalidatePath('/admin/roles')
  revalidatePath('/admin/users')
  revalidatePath('/settings/system')
}

/** ロール一覧（権限行つき）を取得（管理画面用） */
export async function listRolesWithPermissions() {
  await requireAdmin()
  const [roleRows, permRows, userRows] = await Promise.all([
    db.select().from(roles).orderBy(roles.is_system, roles.name),
    db.select().from(role_permissions),
    db.select({ id: users.id, role_id: users.role_id }).from(users),
  ])
  const permsByRole = new Map<string, typeof permRows>()
  for (const p of permRows) {
    if (!permsByRole.has(p.role_id)) permsByRole.set(p.role_id, [])
    permsByRole.get(p.role_id)!.push(p)
  }
  const userCount = new Map<string, number>()
  for (const u of userRows) {
    if (u.role_id) userCount.set(u.role_id, (userCount.get(u.role_id) ?? 0) + 1)
  }
  return roleRows.map((r) => ({
    ...r,
    permissions: permsByRole.get(r.id) ?? [],
    assignedUsers: userCount.get(r.id) ?? 0,
  }))
}

/** 個別ブック行を上書き（'*' 既定行とは独立）— 将来の行単位編集用 */
export async function upsertRolePermission(roleId: string, formData: FormData): Promise<void> {
  await requireAdmin()
  const role = await getRole(roleId)
  if (!role) throw new Error('ロールが見つかりません')
  if (role.is_system) throw new Error('システムロールの権限は固定です')
  const book = (formData.get('book_api') ?? '').toString().trim()
  if (!book) throw new Error('book_api は必須です')
  const flags = {
    can_create: formData.get('can_create') === 'true',
    can_read: formData.get('can_read') === 'true',
    can_update: formData.get('can_update') === 'true',
    can_delete: formData.get('can_delete') === 'true',
  }
  await db.delete(role_permissions).where(and(eq(role_permissions.role_id, roleId), eq(role_permissions.book_api, book)))
  await db.insert(role_permissions).values({ role_id: roleId, book_api: book, ...flags })
  revalidatePath('/admin/roles')
}
