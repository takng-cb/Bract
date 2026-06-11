'use server'

/**
 * 整備フォームのインライン作成（#45）。
 * 取引先・顧客車両をフォームを離れずに新規作成し、{id, label} を返して即時に紐付ける。
 * 取引先は同名の既存があればそれを返す（REQ-0018 軽量版＝重複作成を避ける）。
 */
import { db } from '@/lib/db'
import { accounts, contacts, customer_vehicles, vehicles } from '@/lib/schema'
import { and, eq, ilike, isNull, or } from 'drizzle-orm'
import { canDo } from '@/lib/permissions'

/** 整備の作成 or 更新のどちらかができれば、付随する取引先/車両のインライン作成を許可 */
async function requireMaintenanceWrite(): Promise<void> {
  if (!(await canDo('maintenance_records', 'update')) && !(await canDo('maintenance_records', 'create'))) {
    throw new Error('権限がありません（maintenance_records の作成または更新）')
  }
}

export type InlineAccountResult = { id: string; name: string; existed: boolean }

export async function inlineCreateAccount(input: { name: string; phone?: string }): Promise<InlineAccountResult> {
  await requireMaintenanceWrite()
  const name = input.name?.trim()
  if (!name) throw new Error('取引先名は必須です')

  // 同名（完全一致）が既にあればそれを使う（重複作成防止・REQ-0018）
  const existing = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts).where(eq(accounts.name, name)).limit(1)
  if (existing[0]) return { id: existing[0].id, name: existing[0].name, existed: true }

  const [row] = await db.insert(accounts)
    .values({ name, phone: input.phone?.trim() || null, status: 'active' })
    .returning({ id: accounts.id, name: accounts.name })
  return { id: row.id, name: row.name, existed: false }
}

export type InlineVehicleResult = { id: string; label: string }

export async function inlineCreateCustomerVehicle(input: {
  plate_number?: string
  car_name?: string
  car_model?: string
  account_id?: string
  contact_id?: string
}): Promise<InlineVehicleResult> {
  await requireMaintenanceWrite()
  if (!input.account_id && !input.contact_id) {
    throw new Error('先に顧客（取引先）を指定してください')
  }
  const [row] = await db.insert(customer_vehicles).values({
    account_id:   input.account_id || null,
    contact_id:   input.contact_id || null,
    plate_number: input.plate_number?.trim() || null,
    car_name:     input.car_name?.trim() || null,
    car_model:    input.car_model?.trim() || null,
  }).returning({
    id: customer_vehicles.id,
    plate_number: customer_vehicles.plate_number,
    car_name: customer_vehicles.car_name,
    car_model: customer_vehicles.car_model,
  })
  const label = [row.plate_number, row.car_name ?? row.car_model].filter(Boolean).join(' / ') || '（無名車両）'
  return { id: row.id, label }
}

/** 取引先の同名・部分一致候補（インライン作成時の重複サジェスト用） */
export async function findAccountCandidates(name: string): Promise<{ id: string; name: string }[]> {
  const q = name.trim()
  if (q.length < 1) return []
  return db.select({ id: accounts.id, name: accounts.name })
    .from(accounts).where(ilike(accounts.name, `%${q}%`)).limit(5)
}

/**
 * 人物（顧客担当者 / BtoC 顧客）の部分一致候補。
 * accountId 指定時はその会社の人物のみ、未指定時は親を持たない人物（ToC 顧客）のみ。
 */
export async function findContactCandidates(
  qRaw: string,
  accountId?: string | null,
): Promise<{ id: string; name: string }[]> {
  const q = qRaw.trim()
  if (q.length < 1) return []
  const rows = await db.select({ id: contacts.id, name: contacts.full_name })
    .from(contacts)
    .where(and(
      ilike(contacts.full_name, `%${q}%`),
      accountId ? eq(contacts.account_id, accountId) : isNull(contacts.account_id),
    ))
    .limit(5)
  return rows
}

export type InlineContactResult = { id: string; name: string; existed: boolean }

/** 人物のインライン作成（同名・同所属の既存があれば再利用） */
export async function inlineCreateContact(input: { full_name: string; account_id?: string | null }): Promise<InlineContactResult> {
  await requireMaintenanceWrite()
  const full_name = input.full_name?.trim()
  if (!full_name) throw new Error('氏名は必須です')
  const accountId = input.account_id || null

  const existing = await db.select({ id: contacts.id, name: contacts.full_name })
    .from(contacts)
    .where(and(
      eq(contacts.full_name, full_name),
      accountId ? eq(contacts.account_id, accountId) : isNull(contacts.account_id),
    ))
    .limit(1)
  if (existing[0]) return { id: existing[0].id, name: existing[0].name, existed: true }

  const [row] = await db.insert(contacts)
    .values({ full_name, account_id: accountId, contact_type: accountId ? 'business' : 'consumer' })
    .returning({ id: contacts.id, name: contacts.full_name })
  return { id: row.id, name: row.name, existed: false }
}

/** 代車にできる車両（在庫）の部分一致候補（ナンバー / メーカー / 車種） */
export async function findLoanerVehicleCandidates(qRaw: string): Promise<{ id: string; label: string }[]> {
  const q = qRaw.trim()
  if (q.length < 1) return []
  const p = `%${q}%`
  const rows = await db.select({
    id: vehicles.id, license_plate: vehicles.license_plate, maker: vehicles.maker, model: vehicles.model,
  }).from(vehicles)
    .where(and(
      eq(vehicles.status, '在庫'),
      or(ilike(vehicles.license_plate, p), ilike(vehicles.maker, p), ilike(vehicles.model, p)),
    ))
    .limit(6)
  return rows.map((r) => ({
    id: r.id,
    label: `${r.license_plate ?? '—'} / ${[r.maker, r.model].filter(Boolean).join(' ') || '車両'}`,
  }))
}

export type VehicleCandidate = {
  id: string
  label: string
  account_id: string | null
  contact_id: string | null
}

/** 顧客車両の部分一致候補（ナンバー / 車名 / 車種。検索→なければ新規の UX 用） */
export async function findCustomerVehicleCandidates(qRaw: string): Promise<VehicleCandidate[]> {
  const q = qRaw.trim()
  if (q.length < 1) return []
  const p = `%${q}%`
  const rows = await db.select({
    id: customer_vehicles.id,
    plate_number: customer_vehicles.plate_number,
    car_name: customer_vehicles.car_name,
    car_model: customer_vehicles.car_model,
    account_id: customer_vehicles.account_id,
    contact_id: customer_vehicles.contact_id,
  }).from(customer_vehicles)
    .where(or(
      ilike(customer_vehicles.plate_number, p),
      ilike(customer_vehicles.car_name, p),
      ilike(customer_vehicles.car_model, p),
    ))
    .limit(6)
  return rows.map((r) => ({
    id: r.id,
    label: [r.plate_number, r.car_name ?? r.car_model].filter(Boolean).join(' / ') || '（無名車両）',
    account_id: r.account_id,
    contact_id: r.contact_id,
  }))
}
