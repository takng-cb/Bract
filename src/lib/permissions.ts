/**
 * RBAC: ロール × ブック別 CRUD 権限の解決（REQ-0031 / ADR-0023）
 *
 * 解決順:
 *   1. users.role_id があればそのロールの role_permissions を使用
 *   2. 無ければ users.role（テキスト）と同名の system ロールにフォールバック
 *      （migration が backfill 済みなら通常 1 で解決）＝挙動非変更のストラングラー
 *   3. それも無ければ viewer 相当（全ブック Read のみ）
 *
 * 判定順: ブック個別行 → '*' ワイルドカード行 → false。
 * admin（system ロール）は常に全権。
 *
 * 使い方:
 *   await requirePermission('accounts', 'update')   // Server Action 冒頭ガード
 *   if (await canDo('expenses', 'read')) { ... }    // UI/ページの表示分岐
 */
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, roles, role_permissions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSupabaseUser } from '@/lib/auth'

export type CrudOp = 'create' | 'read' | 'update' | 'delete'

export type BookPerm = { create: boolean; read: boolean; update: boolean; delete: boolean }
export type PermissionSet = {
  roleName: string
  isAdmin: boolean
  /** book_api → CRUD（'*' はワイルドカード既定） */
  byBook: Record<string, BookPerm>
}

const VIEWER_FALLBACK: PermissionSet = {
  roleName: 'viewer',
  isAdmin: false,
  byBook: { '*': { create: false, read: true, update: false, delete: false } },
}

function rowToPerm(r: { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }): BookPerm {
  return { create: r.can_create, read: r.can_read, update: r.can_update, delete: r.can_delete }
}

/** 現在ユーザーの権限セットを解決（リクエスト内キャッシュ） */
export const getCurrentPermissions = cache(async (): Promise<PermissionSet> => {
  const user = await getSupabaseUser()
  if (!user) return VIEWER_FALLBACK

  const u = await db
    .select({ role: users.role, role_id: users.role_id })
    .from(users)
    .where(eq(users.id, user.id))
    .then((r) => r[0] ?? null)
  if (!u) return VIEWER_FALLBACK

  // 1. role_id → 2. users.role テキストと同名 system ロール
  let roleRow: { id: string; name: string; is_system: boolean } | null = null
  if (u.role_id) {
    roleRow = await db.select({ id: roles.id, name: roles.name, is_system: roles.is_system })
      .from(roles).where(eq(roles.id, u.role_id)).then((r) => r[0] ?? null)
  }
  if (!roleRow) {
    roleRow = await db.select({ id: roles.id, name: roles.name, is_system: roles.is_system })
      .from(roles).where(eq(roles.name, u.role)).then((r) => r[0] ?? null)
  }
  if (!roleRow) {
    // roles 未 seed の環境（migration 前）は旧テキストロールで近似＝挙動非変更
    if (u.role === 'admin') return { roleName: 'admin', isAdmin: true, byBook: { '*': { create: true, read: true, update: true, delete: true } } }
    if (u.role === 'editor') return { roleName: 'editor', isAdmin: false, byBook: { '*': { create: true, read: true, update: true, delete: true } } }
    return VIEWER_FALLBACK
  }

  const isAdminRole = roleRow.is_system && roleRow.name === 'admin'
  const permRows = await db.select()
    .from(role_permissions)
    .where(eq(role_permissions.role_id, roleRow.id))

  const byBook: Record<string, BookPerm> = {}
  for (const r of permRows) byBook[r.book_api] = rowToPerm(r)
  if (!byBook['*'] && isAdminRole) byBook['*'] = { create: true, read: true, update: true, delete: true }

  return { roleName: roleRow.name, isAdmin: isAdminRole, byBook }
})

/** 指定ブックの操作が許可されているか */
export async function canDo(bookApi: string, op: CrudOp): Promise<boolean> {
  const p = await getCurrentPermissions()
  if (p.isAdmin) return true
  const perm = p.byBook[bookApi] ?? p.byBook['*']
  return perm ? perm[op] : false
}

/** Server Action 冒頭ガード（不許可なら例外） */
export class PermissionDeniedError extends Error {
  constructor(public readonly bookApi: string, public readonly op: CrudOp) {
    super(`この操作には権限がありません（${bookApi} の ${op}）。管理者にロール設定を確認してください。`)
    this.name = 'PermissionDeniedError'
  }
}

export async function requirePermission(bookApi: string, op: CrudOp): Promise<void> {
  if (!(await canDo(bookApi, op))) throw new PermissionDeniedError(bookApi, op)
}

/** ページ用 Read ガード（read 不可ならダッシュボードへ） */
export async function requireBookRead(bookApi: string): Promise<void> {
  if (!(await canDo(bookApi, 'read'))) redirect('/dashboard')
}

/**
 * ナビ href → book_api の対応（Read 権限によるサイドバー/検索のフィルタに使用）。
 * カスタムブックは /objects/<api> 形式なので動的に解決する。
 */
export const HREF_BOOK: Record<string, string> = {
  '/accounts': 'accounts',
  '/contacts': 'contacts',
  '/opportunities': 'opportunities',
  '/forecast': 'opportunities',
  '/activities': 'activities',
  '/tasks': 'tasks',
  '/expenses': 'expenses',
  '/products': 'products',
  '/warehouses': 'warehouses',
  '/stock-movements': 'stock_movements',
  '/wiki': 'wiki_pages',
  '/properties': 'properties',
  '/vehicles': 'vehicles',
  '/parts': 'parts',
  '/maintenance': 'maintenance_records',
  '/customer-vehicles': 'customer_vehicles',
  '/receivables': 'maintenance_records',
  '/staff': 'staff',
  '/assignments': 'assignments',
}

/** href から book_api を解決（カスタムは /objects/<api>） */
export function bookForHref(href: string): string | null {
  if (HREF_BOOK[href]) return HREF_BOOK[href]
  const m = href.match(/^\/objects\/([^/]+)/)
  return m ? m[1] : null
}

/** ナビ項目を Read 権限でフィルタ（book 対応が無い href は残す） */
export async function filterNavByRead<T extends { href: string }>(items: T[]): Promise<T[]> {
  const p = await getCurrentPermissions()
  if (p.isAdmin) return items
  const out: T[] = []
  for (const item of items) {
    const book = bookForHref(item.href)
    if (!book) { out.push(item); continue }
    const perm = p.byBook[book] ?? p.byBook['*']
    if (perm?.read) out.push(item)
  }
  return out
}
