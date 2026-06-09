'use server'

/**
 * 整備フォームのインライン作成（#45）。
 * 取引先・顧客車両をフォームを離れずに新規作成し、{id, label} を返して即時に紐付ける。
 * 取引先は同名の既存があればそれを返す（REQ-0018 軽量版＝重複作成を避ける）。
 */
import { db } from '@/lib/db'
import { accounts, customer_vehicles } from '@/lib/schema'
import { requireEditor } from '@/lib/auth'
import { eq, ilike } from 'drizzle-orm'

export type InlineAccountResult = { id: string; name: string; existed: boolean }

export async function inlineCreateAccount(input: { name: string; phone?: string }): Promise<InlineAccountResult> {
  await requireEditor()
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
  await requireEditor()
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
