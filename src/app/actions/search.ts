'use server'

/**
 * グローバル検索（トップバー）。
 *
 * 取引先・人物・商談＋（有効モジュールに応じて）業種/ERP の主要ブックを横断検索し、
 * グループ別の結果を返す。各レコードの詳細 URL も付与する。
 *
 * - モジュール有効判定（isModuleEnabled）でビルド業種に応じた対象だけを検索する
 *   （例: auto-body デプロイでは properties は検索されない）。
 * - 名前系カラムの ILIKE 部分一致。各グループ最大 6 件。
 * - typed テーブルの id をそのまま詳細 URL に使うため、リンク先は確実に解決する。
 */
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities,
  vehicles, customer_vehicles, parts, maintenance_records,
  products, warehouses, staff, assignments, wiki_pages,
} from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { ilike, or, desc } from 'drizzle-orm'
import { isModuleEnabled } from '@/lib/modules/registry'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const PER_GROUP = 6

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

  const [inventoryOn, realEstateOn, autoBodyOn, staffingOn] = await Promise.all([
    isModuleEnabled('inventory'),
    isModuleEnabled('real-estate'),
    isModuleEnabled('auto-body'),
    isModuleEnabled('staffing'),
  ])

  const groups: SearchGroup[] = []

  // ── コア（常時） ────────────────────────────────
  const [accRows, conRows, oppRows, wikiRows] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name, industry: accounts.industry })
      .from(accounts).where(ilike(accounts.name, p)).limit(PER_GROUP),
    db.select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title })
      .from(contacts).where(or(ilike(contacts.full_name, p), ilike(contacts.email, p))).limit(PER_GROUP),
    db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage })
      .from(opportunities).where(ilike(opportunities.name, p)).limit(PER_GROUP),
    db.select({ id: wiki_pages.id, title: wiki_pages.title })
      .from(wiki_pages).where(ilike(wiki_pages.title, p)).orderBy(desc(wiki_pages.updated_at)).limit(PER_GROUP),
  ])
  if (accRows.length) groups.push({ type: 'accounts', label: '取引先', icon: '🏢',
    hits: accRows.map((r) => ({ id: r.id, label: r.name, sub: r.industry ?? undefined, href: `/accounts/${r.id}` })) })
  if (conRows.length) groups.push({ type: 'contacts', label: '人物', icon: '👤',
    hits: conRows.map((r) => ({ id: r.id, label: r.full_name, sub: r.title ?? undefined, href: `/contacts/${r.id}` })) })
  if (oppRows.length) groups.push({ type: 'opportunities', label: '商談', icon: '💼',
    hits: oppRows.map((r) => ({ id: r.id, label: r.name, sub: r.stage ?? undefined, href: `/opportunities/${r.id}` })) })
  if (wikiRows.length) groups.push({ type: 'wiki', label: 'Wiki', icon: '📖',
    hits: wikiRows.map((r) => ({ id: r.id, label: r.title, href: `/wiki/${r.id}` })) })

  // ── 在庫（inventory） ───────────────────────────
  if (inventoryOn) {
    const [prodRows, whRows] = await Promise.all([
      db.select({ id: products.id, name: products.name, sku: products.sku })
        .from(products).where(or(ilike(products.name, p), ilike(products.sku, p))).limit(PER_GROUP),
      db.select({ id: warehouses.id, name: warehouses.name, code: warehouses.code })
        .from(warehouses).where(or(ilike(warehouses.name, p), ilike(warehouses.code, p))).limit(PER_GROUP),
    ])
    if (prodRows.length) groups.push({ type: 'products', label: '商品', icon: '📦',
      hits: prodRows.map((r) => ({ id: r.id, label: r.name, sub: r.sku, href: `/products/${r.id}` })) })
    if (whRows.length) groups.push({ type: 'warehouses', label: '倉庫', icon: '🏬',
      hits: whRows.map((r) => ({ id: r.id, label: r.name, sub: r.code, href: `/warehouses/${r.id}` })) })
  }

  // ── 不動産（real-estate） ───────────────────────
  if (realEstateOn) {
    const propRows = await db.select({ id: properties.id, name: properties.name })
      .from(properties).where(ilike(properties.name, p)).limit(PER_GROUP)
    if (propRows.length) groups.push({ type: 'properties', label: '物件', icon: '🏠',
      hits: propRows.map((r) => ({ id: r.id, label: r.name, href: `/properties/${r.id}` })) })
  }

  // ── 板金・整備（auto-body） ─────────────────────
  if (autoBodyOn) {
    const [vRows, cvRows, partRows, mRows] = await Promise.all([
      db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate })
        .from(vehicles).where(or(ilike(vehicles.license_plate, p), ilike(vehicles.maker, p), ilike(vehicles.model, p))).limit(PER_GROUP),
      db.select({ id: customer_vehicles.id, plate_number: customer_vehicles.plate_number, car_name: customer_vehicles.car_name, car_model: customer_vehicles.car_model })
        .from(customer_vehicles).where(or(ilike(customer_vehicles.plate_number, p), ilike(customer_vehicles.car_name, p), ilike(customer_vehicles.car_model, p))).limit(PER_GROUP),
      db.select({ id: parts.id, name: parts.name, part_number: parts.part_number })
        .from(parts).where(or(ilike(parts.name, p), ilike(parts.part_number, p))).limit(PER_GROUP),
      db.select({ id: maintenance_records.id, maintenance_no: maintenance_records.maintenance_no })
        .from(maintenance_records).where(ilike(maintenance_records.maintenance_no, p)).orderBy(desc(maintenance_records.created_at)).limit(PER_GROUP),
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
        .from(staff).where(or(ilike(staff.name, p), ilike(staff.name_kana, p))).limit(PER_GROUP),
      db.select({ id: assignments.id, title: assignments.title, assignment_no: assignments.assignment_no })
        .from(assignments).where(or(ilike(assignments.title, p), ilike(assignments.assignment_no, p))).limit(PER_GROUP),
    ])
    if (staffRows.length) groups.push({ type: 'staff', label: 'スタッフ', icon: '🧑‍💼',
      hits: staffRows.map((r) => ({ id: r.id, label: r.name, sub: r.status ?? undefined, href: `/staff/${r.id}` })) })
    if (asgRows.length) groups.push({ type: 'assignments', label: '案件', icon: '📋',
      hits: asgRows.map((r) => ({ id: r.id, label: r.title ?? r.assignment_no, sub: r.title ? r.assignment_no : undefined, href: `/assignments/${r.id}` })) })
  }

  return groups
}
