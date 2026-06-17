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
import { getSupabaseUser, getCurrentUserId } from '@/lib/auth'

export type CrudOp = 'create' | 'read' | 'update' | 'delete'

/** レコードスコープ（REQ-0083 / ADR-0029）。'all'=全件 / 'own'=owner_id が自分のみ（将来 'team'）。 */
export type RecordScope = 'all' | 'own'

export type BookPerm = {
  create: boolean; read: boolean; update: boolean; delete: boolean
  /** read 系（read）の可視範囲 */
  readScope: RecordScope
  /** write 系（create/update/delete）の操作範囲 */
  writeScope: RecordScope
}
export type PermissionSet = {
  roleName: string
  isAdmin: boolean
  /** book_api → CRUD＋スコープ（'*' はワイルドカード既定） */
  byBook: Record<string, BookPerm>
}

/** 全件スコープの BookPerm（フォールバック用ヘルパ） */
function fullScope(p: Omit<BookPerm, 'readScope' | 'writeScope'>): BookPerm {
  return { ...p, readScope: 'all', writeScope: 'all' }
}

const VIEWER_FALLBACK: PermissionSet = {
  roleName: 'viewer',
  isAdmin: false,
  byBook: { '*': fullScope({ create: false, read: true, update: false, delete: false }) },
}

function normScope(v: string | null | undefined): RecordScope {
  return v === 'own' ? 'own' : 'all'
}

function rowToPerm(r: {
  can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean
  read_scope?: string | null; write_scope?: string | null
}): BookPerm {
  return {
    create: r.can_create, read: r.can_read, update: r.can_update, delete: r.can_delete,
    readScope: normScope(r.read_scope), writeScope: normScope(r.write_scope),
  }
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
    if (u.role === 'admin') return { roleName: 'admin', isAdmin: true, byBook: { '*': fullScope({ create: true, read: true, update: true, delete: true }) } }
    if (u.role === 'editor') return { roleName: 'editor', isAdmin: false, byBook: { '*': fullScope({ create: true, read: true, update: true, delete: true }) } }
    return VIEWER_FALLBACK
  }

  const isAdminRole = roleRow.is_system && roleRow.name === 'admin'
  const permRows = await db.select()
    .from(role_permissions)
    .where(eq(role_permissions.role_id, roleRow.id))

  const byBook: Record<string, BookPerm> = {}
  for (const r of permRows) byBook[r.book_api] = rowToPerm(r)
  if (!byBook['*'] && isAdminRole) byBook['*'] = fullScope({ create: true, read: true, update: true, delete: true })

  return { roleName: roleRow.name, isAdmin: isAdminRole, byBook }
})

/** 指定ブックの操作が許可されているか */
export async function canDo(bookApi: string, op: CrudOp): Promise<boolean> {
  const p = await getCurrentPermissions()
  if (p.isAdmin) return true
  const perm = p.byBook[bookApi] ?? p.byBook['*']
  return perm ? perm[op] : false
}

/* ── レコードスコープ（REQ-0083 / ADR-0029）─────────────────────────────
 * 可視性は「層1: canDo（ブック CRUD）」と「層2: レコードスコープ」の AND。
 * 一覧は recordScope() で 'all'|'own' を取り、'own' なら SQL の WHERE に
 * owner_id = me を AND する（JS 後フィルタはページ/件数が壊れるため不可）。
 * 詳細・サーバアクションは canSeeRecord() で対象1件を同ロジックで再判定する
 * （リストに出さなくても直 URL を叩かれるため）。
 */
function scopeFor(p: PermissionSet, bookApi: string, op: CrudOp): RecordScope {
  const perm = p.byBook[bookApi] ?? p.byBook['*']
  if (!perm) return 'all'
  return op === 'read' ? perm.readScope : perm.writeScope
}

/** 指定ブック・操作のレコードスコープ（admin は常に 'all'）。一覧の述語生成に使う。 */
export async function recordScope(bookApi: string, op: CrudOp): Promise<RecordScope> {
  const p = await getCurrentPermissions()
  if (p.isAdmin) return 'all'
  return scopeFor(p, bookApi, op)
}

/**
 * 単一レコードが可視/操作可能か（層1＋層2）。
 * 詳細ページ（notFound 分岐）・サーバアクション（拒否）から呼ぶ。
 * @param ownerId 対象レコードの owner_id（null 可）
 */
export async function canSeeRecord(bookApi: string, op: CrudOp, ownerId: string | null): Promise<boolean> {
  const p = await getCurrentPermissions()
  if (p.isAdmin) return true
  const perm = p.byBook[bookApi] ?? p.byBook['*']
  if (!perm || !perm[op]) return false                 // 層1: ブック CRUD
  if (scopeFor(p, bookApi, op) === 'all') return true   // 層2: スコープ
  const me = await getCurrentUserId()
  return !!me && ownerId === me
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

/** サーバアクション用：対象レコードの owner_id を渡し、スコープ違反なら拒否（REQ-0083）。 */
export async function requireRecordScope(bookApi: string, op: CrudOp, ownerId: string | null): Promise<void> {
  if (!(await canSeeRecord(bookApi, op, ownerId))) throw new PermissionDeniedError(bookApi, op)
}

/** ページ用 Read ガード（read 不可ならダッシュボードへ） */
export async function requireBookRead(bookApi: string): Promise<void> {
  if (!(await canDo(bookApi, 'read'))) redirect('/dashboard')
}

/**
 * ナビ href → book_api の対応（Read 権限によるサイドバー/検索のフィルタに使用）。
 * カスタムブックは /books/<api> 形式なので動的に解決する。
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
  '/invoices': 'assignments',  // 売上・請求は案件の付帯（RBAC は assignments に従う）
}

/** href から book_api を解決（カスタムは /books/<api>） */
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
