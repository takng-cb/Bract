/**
 * vehicles テーブルと book_records テーブルの同期ヘルパー（auto-body 業種専用）
 *
 * 設計（real-estate の properties と同じハイブリッドパターン）:
 *   - vehicles テーブル: 型付きカラムで詳細情報を保持
 *   - book_records テーブル: 同一 UUID で軽量な JSON ミラー
 *
 * リレーション機能（activities, tasks, expenses, relationship_values 等）が
 * book_records.id を参照しているため、業種専用テーブルも book_records に
 * ミラーしておく必要がある。
 *
 * このファイルは vehicle CRUD アクションから呼ばれ、ミラー側も同時更新する。
 */

import { db } from '@/lib/db'
import { book_records, book_definitions } from '@/lib/schema'
import { eq } from 'drizzle-orm'

const VEHICLES_API_NAME = 'vehicles'

/** activities/tasks/expenses 等の関連先表示用ラベル */
function vehicleLabel(v: VehicleSummary): string {
  return [
    `${v.maker} ${v.model}`,
    v.year ? `${v.year}年式` : null,
    v.license_plate,
  ].filter(Boolean).join(' / ')
}

export type VehicleSummary = {
  id: string
  maker: string
  model: string
  year: number | null
  mileage: number | null
  color: string | null
  license_plate: string | null
  vin: string | null
  status: string
  owner_id: string | null
}

/** vehicles 行を book_records にミラーする（INSERT または UPDATE） */
export async function syncVehicleToCustomRecord(v: VehicleSummary): Promise<void> {
  const objId = await getVehiclesObjectId()
  if (!objId) return  // book_definitions に vehicles が無い → ミラー不要

  const data = {
    name:          vehicleLabel(v),
    maker:         v.maker,
    model:         v.model,
    year:          v.year,
    mileage:       v.mileage,
    color:         v.color,
    license_plate: v.license_plate,
    vin:           v.vin,
    status:        v.status,
  }

  const existing = await db.select({ id: book_records.id })
    .from(book_records).where(eq(book_records.id, v.id))

  if (existing.length > 0) {
    await db.update(book_records)
      .set({ data, owner_id: v.owner_id, updated_at: new Date() })
      .where(eq(book_records.id, v.id))
  } else {
    await db.insert(book_records).values({
      id:        v.id,
      object_id: objId,
      data,
      owner_id:  v.owner_id,
    })
  }
}

/** vehicle 削除時のミラー削除 */
export async function deleteVehicleCustomRecord(vehicleId: string): Promise<void> {
  await db.delete(book_records).where(eq(book_records.id, vehicleId))
}

let _cachedObjectId: string | null = null
async function getVehiclesObjectId(): Promise<string | null> {
  if (_cachedObjectId) return _cachedObjectId
  const rows = await db.select({ id: book_definitions.id })
    .from(book_definitions)
    .where(eq(book_definitions.api_name, VEHICLES_API_NAME))
  _cachedObjectId = rows[0]?.id ?? null
  return _cachedObjectId
}
