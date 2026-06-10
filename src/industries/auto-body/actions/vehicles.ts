'use server'

import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { vehicles } from '@/industries/auto-body/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logChanges } from '@/lib/changeLog'
import {
  syncVehicleToCustomRecord,
  deleteVehicleCustomRecord,
} from '@/industries/auto-body/lib/vehicleCustomRecordSync'

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function n(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const num = Number(v)
  return Number.isFinite(num) ? String(num) : null
}
function i(formData: FormData, key: string): number | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const num = Number(v)
  return Number.isFinite(num) ? Math.round(num) : null
}

export async function createVehicle(formData: FormData): Promise<string> {
  await requireEditor()
  const maker = s(formData, 'maker')
  const model = s(formData, 'model')
  if (!maker) throw new Error('メーカーは必須です')
  if (!model) throw new Error('車種は必須です')

  const ownerId = s(formData, 'owner_id')

  const [row] = await db.insert(vehicles).values({
    maker,
    model,
    year:                 i(formData, 'year'),
    mileage:              i(formData, 'mileage'),
    color:                s(formData, 'color'),
    license_plate:        s(formData, 'license_plate'),
    vin:                  s(formData, 'vin'),
    status:               s(formData, 'status') ?? '在庫',
    purchase_date:        s(formData, 'purchase_date'),
    purchase_price:       n(formData, 'purchase_price'),
    supplier_account_id:  s(formData, 'supplier_account_id'),
    sale_price:           n(formData, 'sale_price'),
    sold_date:            s(formData, 'sold_date'),
    sold_price:           n(formData, 'sold_price'),
    buyer_account_id:     s(formData, 'buyer_account_id'),
    next_inspection_date: s(formData, 'next_inspection_date'),
    description:          s(formData, 'description'),
    owner_id:             ownerId,
  }).returning({ id: vehicles.id })

  // custom_records ミラー（activities/tasks/expenses 等の関連先表示用）
  await syncVehicleToCustomRecord({
    id: row.id, maker, model,
    year: i(formData, 'year'),
    mileage: i(formData, 'mileage'),
    color: s(formData, 'color'),
    license_plate: s(formData, 'license_plate'),
    vin: s(formData, 'vin'),
    status: s(formData, 'status') ?? '在庫',
    owner_id: ownerId,
  })

  return row.id
}

export async function updateVehicle(id: string, formData: FormData) {
  await requireEditor()
  const maker = s(formData, 'maker')
  const model = s(formData, 'model')
  if (!maker) throw new Error('メーカーは必須です')
  if (!model) throw new Error('車種は必須です')

  const [before] = await db.select().from(vehicles).where(eq(vehicles.id, id))

  const next = {
    maker,
    model,
    year:                 i(formData, 'year'),
    mileage:              i(formData, 'mileage'),
    color:                s(formData, 'color'),
    license_plate:        s(formData, 'license_plate'),
    vin:                  s(formData, 'vin'),
    status:               s(formData, 'status') ?? '在庫',
    purchase_date:        s(formData, 'purchase_date'),
    purchase_price:       n(formData, 'purchase_price'),
    supplier_account_id:  s(formData, 'supplier_account_id'),
    sale_price:           n(formData, 'sale_price'),
    sold_date:            s(formData, 'sold_date'),
    sold_price:           n(formData, 'sold_price'),
    buyer_account_id:     s(formData, 'buyer_account_id'),
    next_inspection_date: s(formData, 'next_inspection_date'),
    description:          s(formData, 'description'),
    owner_id:             s(formData, 'owner_id'),
    updated_at:           new Date(),
  }
  await db.update(vehicles).set(next).where(eq(vehicles.id, id))

  // custom_records ミラーを更新
  await syncVehicleToCustomRecord({
    id,
    maker:         next.maker,
    model:         next.model,
    year:          next.year,
    mileage:       next.mileage,
    color:         next.color,
    license_plate: next.license_plate,
    vin:           next.vin,
    status:        next.status,
    owner_id:      next.owner_id,
  })

  if (before) {
    await logChanges('vehicle', id,
      {
        maker:          { label: 'メーカー',   value: before.maker },
        model:          { label: '車種',       value: before.model },
        status:         { label: '状態',       value: before.status },
        purchase_price: { label: '仕入価格',   value: before.purchase_price },
        sale_price:     { label: '希望売価',   value: before.sale_price },
        sold_price:     { label: '売却価格',   value: before.sold_price },
        next_inspection_date: { label: '次回車検', value: before.next_inspection_date },
      },
      {
        maker:          { label: 'メーカー',   value: next.maker },
        model:          { label: '車種',       value: next.model },
        status:         { label: '状態',       value: next.status },
        purchase_price: { label: '仕入価格',   value: next.purchase_price },
        sale_price:     { label: '希望売価',   value: next.sale_price },
        sold_price:     { label: '売却価格',   value: next.sold_price },
        next_inspection_date: { label: '次回車検', value: next.next_inspection_date },
      },
    )
  }

  redirect(`/vehicles/${id}`)
}

/**
 * 車両情報（概要カード）のインライン編集用・部分更新。
 * 送信された基本項目（ナンバー/車台番号/次回車検/備考）のみ更新し、仕入/売却等には
 * 触れない。custom_records ミラーは全行から再同期する。
 */
export async function updateVehicleBasic(id: string, formData: FormData) {
  await requireEditor()
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('license_plate'))        set.license_plate = s(formData, 'license_plate')
  if (formData.has('vin'))                  set.vin = s(formData, 'vin')
  if (formData.has('next_inspection_date')) set.next_inspection_date = s(formData, 'next_inspection_date')
  if (formData.has('description'))          set.description = s(formData, 'description')
  await db.update(vehicles).set(set).where(eq(vehicles.id, id))

  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id))
  if (row) await syncVehicleToCustomRecord({
    id, maker: row.maker, model: row.model, year: row.year, mileage: row.mileage,
    color: row.color, license_plate: row.license_plate, vin: row.vin, status: row.status, owner_id: row.owner_id,
  })
  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${id}`)
  redirect(`/vehicles/${id}`)
}

/** ステータスのみ更新（矢羽根 StageBar 用）。custom_records ミラーも同期 */
export async function setVehicleStatus(id: string, status: string) {
  await requireEditor()
  await db.update(vehicles).set({ status, updated_at: new Date() }).where(eq(vehicles.id, id))
  const [v] = await db.select({
    id: vehicles.id, maker: vehicles.maker, model: vehicles.model, year: vehicles.year,
    mileage: vehicles.mileage, color: vehicles.color, license_plate: vehicles.license_plate,
    vin: vehicles.vin, status: vehicles.status, owner_id: vehicles.owner_id,
  }).from(vehicles).where(eq(vehicles.id, id))
  if (v) await syncVehicleToCustomRecord(v)
  revalidatePath(`/vehicles/${id}`)
  revalidatePath('/vehicles')
}

export async function deleteVehicle(id: string) {
  await requireEditor()
  await db.delete(vehicles).where(eq(vehicles.id, id))
  // custom_records ミラー側も削除（cascade ではないので明示的に）
  await deleteVehicleCustomRecord(id)
  redirect('/vehicles')
}
