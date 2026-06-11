'use server'

/**
 * グローバル検索（トップバー）。
 *
 * 取引先・人物・商談＋（有効モジュールに応じて）業種/ERP の主要ブックを横断検索し、
 * グループ別の結果を返す。各レコードの詳細 URL も付与する。
 *
 * - モジュール有効判定（isModuleEnabled）でビルド業種に応じた対象だけを検索する
 *   （例: auto-body デプロイでは properties は検索されない）。
 * - **全テキスト項目**の ILIKE 部分一致（住所・電話・備考なども対象。textColumnsWhere が
 *   テーブルのテキストカラムを自動収集するため、カラム追加にも自動追従）。各グループ最大 6 件。
 * - カスタムブックは book_records.data（JSON）全体を ::text で部分一致検索する。
 * - typed テーブルの id をそのまま詳細 URL に使うため、リンク先は確実に解決する。
 */
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities, expenses,
  vehicles, customer_vehicles, parts, maintenance_records,
  products, warehouses, staff, assignments, wiki_pages,
  book_definitions, book_records,
} from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { textColumnsWhere } from '@/lib/searchWhere'
import { isModuleEnabled } from '@/lib/modules/registry'
import { canDo } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const PER_GROUP = 6

/** typed テーブルで検索済みの api（カスタム側のミラー行を重複検索しないための除外リスト） */
const TYPED_APIS = new Set([
  'accounts', 'contacts', 'opportunities', 'expenses', 'wiki_pages',
  'products', 'warehouses', 'properties', 'vehicles', 'customer_vehicles',
  'parts', 'maintenance_records', 'staff', 'assignments',
])

export type SearchHit = { id: string; label: string; sub?: string; href: string }
export type SearchGroup = { type: string; label: string; icon: string; hits: SearchHit[] }

export async function globalSearch(qRaw: string): Promise<SearchGroup[]> {
  const q = (qRaw ?? '').trim()
  if (q.length < 1) return []

  // 認証（ログインユーザーのみ）
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const p = `%${q}%`

  const [inventoryOn, realEstateOn, autoBodyOn, staffingOn, expensesOn] = await Promise.all([
    isModuleEnabled('inventory'),
    isModuleEnabled('real-estate'),
    isModuleEnabled('auto-body'),
    isModuleEnabled('staffing'),
    isModuleEnabled('expenses'),
  ])

  const groups: SearchGroup[] = []

  // ── コア（常時） ────────────────────────────────
  const [accRows, conRows, oppRows, wikiRows] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name, industry: accounts.industry })
      .from(accounts).where(textColumnsWhere(accounts, p)).limit(PER_GROUP),
    db.select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title })
      .from(contacts).where(textColumnsWhere(contacts, p)).limit(PER_GROUP),
    db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage })
      .from(opportunities).where(textColumnsWhere(opportunities, p)).limit(PER_GROUP),
    db.select({ id: wiki_pages.id, title: wiki_pages.title })
      .from(wiki_pages).where(textColumnsWhere(wiki_pages, p)).orderBy(desc(wiki_pages.updated_at)).limit(PER_GROUP),
  ])
  if (accRows.length) groups.push({ type: 'accounts', label: '取引先', icon: '🏢',
    hits: accRows.map((r) => ({ id: r.id, label: r.name, sub: r.industry ?? undefined, href: `/accounts/${r.id}` })) })
  if (conRows.length) groups.push({ type: 'contacts', label: '人物', icon: '👤',
    hits: conRows.map((r) => ({ id: r.id, label: r.full_name, sub: r.title ?? undefined, href: `/contacts/${r.id}` })) })
  if (oppRows.length) groups.push({ type: 'opportunities', label: '商談', icon: '💼',
    hits: oppRows.map((r) => ({ id: r.id, label: r.name, sub: r.stage ?? undefined, href: `/opportunities/${r.id}` })) })
  if (wikiRows.length) groups.push({ type: 'wiki', label: 'Wiki', icon: '📖',
    hits: wikiRows.map((r) => ({ id: r.id, label: r.title, href: `/wiki/${r.id}` })) })

  // ── 経費（expenses） ────────────────────────────
  if (expensesOn) {
    const expRows = await db.select({ id: expenses.id, title: expenses.title, category: expenses.category })
      .from(expenses).where(textColumnsWhere(expenses, p)).orderBy(desc(expenses.expense_date)).limit(PER_GROUP)
    if (expRows.length) groups.push({ type: 'expenses', label: '経費', icon: '💰',
      hits: expRows.map((r) => ({ id: r.id, label: r.title, sub: r.category ?? undefined, href: `/expenses/${r.id}` })) })
  }

  // ── 在庫（inventory） ───────────────────────────
  if (inventoryOn) {
    const [prodRows, whRows] = await Promise.all([
      db.select({ id: products.id, name: products.name, sku: products.sku })
        .from(products).where(textColumnsWhere(products, p)).limit(PER_GROUP),
      db.select({ id: warehouses.id, name: warehouses.name, code: warehouses.code })
        .from(warehouses).where(textColumnsWhere(warehouses, p)).limit(PER_GROUP),
    ])
    if (prodRows.length) groups.push({ type: 'products', label: '商品', icon: '📦',
      hits: prodRows.map((r) => ({ id: r.id, label: r.name, sub: r.sku, href: `/products/${r.id}` })) })
    if (whRows.length) groups.push({ type: 'warehouses', label: '倉庫', icon: '🏬',
      hits: whRows.map((r) => ({ id: r.id, label: r.name, sub: r.code, href: `/warehouses/${r.id}` })) })
  }

  // ── 不動産（real-estate） ───────────────────────
  if (realEstateOn) {
    const propRows = await db.select({ id: properties.id, name: properties.name, address: properties.address })
      .from(properties).where(textColumnsWhere(properties, p)).limit(PER_GROUP)
    if (propRows.length) groups.push({ type: 'properties', label: '物件', icon: '🏠',
      hits: propRows.map((r) => ({ id: r.id, label: r.name, sub: r.address ?? undefined, href: `/properties/${r.id}` })) })
  }

  // ── 板金・整備（auto-body） ─────────────────────
  if (autoBodyOn) {
    const [vRows, cvRows, partRows, mRows] = await Promise.all([
      db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate })
        .from(vehicles).where(textColumnsWhere(vehicles, p)).limit(PER_GROUP),
      db.select({ id: customer_vehicles.id, plate_number: customer_vehicles.plate_number, car_name: customer_vehicles.car_name, car_model: customer_vehicles.car_model })
        .from(customer_vehicles).where(textColumnsWhere(customer_vehicles, p)).limit(PER_GROUP),
      db.select({ id: parts.id, name: parts.name, part_number: parts.part_number })
        .from(parts).where(textColumnsWhere(parts, p)).limit(PER_GROUP),
      db.select({ id: maintenance_records.id, maintenance_no: maintenance_records.maintenance_no })
        .from(maintenance_records).where(textColumnsWhere(maintenance_records, p)).orderBy(desc(maintenance_records.created_at)).limit(PER_GROUP),
    ])
    if (vRows.length) groups.push({ type: 'vehicles', label: '車両', icon: '🚗',
      hits: vRows.map((r) => ({ id: r.id, label: [r.maker, r.model].filter(Boolean).join(' ') || '車両', sub: r.license_plate ?? undefined, href: `/vehicles/${r.id}` })) })
    if (cvRows.length) groups.push({ type: 'customer-vehicles', label: '顧客車両', icon: '🚙',
      hits: cvRows.map((r) => ({ id: r.id, label: r.plate_number ?? ([r.car_name, r.car_model].filter(Boolean).join(' ') || '顧客車両'), sub: [r.car_name, r.car_model].filter(Boolean).join(' ') || undefined, href: `/customer-vehicles/${r.id}` })) })
    if (partRows.length) groups.push({ type: 'parts', label: '部品', icon: '🪛',
      hits: partRows.map((r) => ({ id: r.id, label: r.name, sub: r.part_number, href: `/parts/${r.id}` })) })
    if (mRows.length) groups.push({ type: 'maintenance', label: '整備', icon: '🔧',
      hits: mRows.map((r) => ({ id: r.id, label: r.maintenance_no, href: `/maintenance/${r.id}` })) })
  }

  // ── 人材手配（staffing） ────────────────────────
  if (staffingOn) {
    const [staffRows, asgRows] = await Promise.all([
      db.select({ id: staff.id, name: staff.name, status: staff.status })
        .from(staff).where(textColumnsWhere(staff, p)).limit(PER_GROUP),
      db.select({ id: assignments.id, title: assignments.title, assignment_no: assignments.assignment_no })
        .from(assignments).where(textColumnsWhere(assignments, p)).limit(PER_GROUP),
    ])
    if (staffRows.length) groups.push({ type: 'staff', label: 'スタッフ', icon: '🧑‍💼',
      hits: staffRows.map((r) => ({ id: r.id, label: r.name, sub: r.status ?? undefined, href: `/staff/${r.id}` })) })
    if (asgRows.length) groups.push({ type: 'assignments', label: '案件', icon: '📋',
      hits: asgRows.map((r) => ({ id: r.id, label: r.title ?? r.assignment_no, sub: r.title ? r.assignment_no : undefined, href: `/assignments/${r.id}` })) })
  }

  // ── カスタムブック（data JSON 全体を部分一致） ───────────
  // typed テーブルで検索済みの api（ミラー行）は除外して重複ヒットを防ぐ。
  const customDefs = await db.select({
    id: book_definitions.id, api_name: book_definitions.api_name,
    label_plural: book_definitions.label_plural, icon: book_definitions.icon,
  }).from(book_definitions).where(eq(book_definitions.is_builtin, false))
  const searchableDefs = customDefs.filter((o) => !TYPED_APIS.has(o.api_name))
  if (searchableDefs.length > 0) {
    const rows = await db.select({ id: book_records.id, object_id: book_records.object_id, data: book_records.data })
      .from(book_records)
      .where(and(
        inArray(book_records.object_id, searchableDefs.map((o) => o.id)),
        sql`${book_records.data}::text ILIKE ${p}`,
      ))
      .limit(PER_GROUP * 4)
    for (const obj of searchableDefs) {
      const hits: SearchHit[] = rows
        .filter((r) => r.object_id === obj.id)
        .slice(0, PER_GROUP)
        .map((r) => {
          const d = (r.data ?? {}) as Record<string, unknown>
          const label = (typeof d.name === 'string' && d.name) || (typeof d.title === 'string' && d.title) || `#${r.id.slice(0, 8)}`
          return { id: r.id, label, href: `/books/${obj.api_name}/${r.id}` }
        })
      if (hits.length) groups.push({ type: `objects:${obj.api_name}`, label: obj.label_plural, icon: obj.icon, hits })
    }
  }

  // RBAC: Read 権限が無いブックの結果を除外（ADR-0023）
  const TYPE_BOOK: Record<string, string> = {
    accounts: 'accounts', contacts: 'contacts', opportunities: 'opportunities', wiki: 'wiki_pages',
    expenses: 'expenses',
    products: 'products', warehouses: 'warehouses', properties: 'properties', vehicles: 'vehicles',
    'customer-vehicles': 'customer_vehicles', parts: 'parts', maintenance: 'maintenance_records',
    staff: 'staff', assignments: 'assignments',
  }
  const visible: SearchGroup[] = []
  for (const g of groups) {
    const book = g.type.startsWith('objects:') ? g.type.slice('objects:'.length) : TYPE_BOOK[g.type]
    if (!book || (await canDo(book, 'read'))) visible.push(g)
  }
  return visible
}
