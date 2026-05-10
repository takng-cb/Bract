/**
 * properties テーブルと custom_records テーブルの同期ヘルパー（real-estate 業種専用）
 *
 * 設計（auto-body の vehicles と同じハイブリッドパターン）:
 *   - properties テーブル: 型付きカラムで詳細情報を保持（土地・建物登記など）
 *   - custom_records テーブル: 同一 UUID で軽量な JSON ミラー
 *
 * リレーション機能（activities, tasks, expenses, relationship_values 等）が
 * custom_records.id を参照しているため、業種専用テーブルも custom_records に
 * ミラーしておく必要がある。
 *
 * 過去の運用:
 *   - 一回限りの初期 backfill: scripts/migrate-properties-to-custom.mjs
 *     → これで初期 13 件は同期済み
 *   - その後の CRUD で同期されていなかった（バグ）
 *   - このヘルパーで CRUD アクション側に sync を組み込み、整合を維持する
 */

import { db } from '@/lib/db'
import { custom_records, object_definitions } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { eq } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'

const PROPERTIES_API_NAME = 'properties'

type PropertyRow = InferSelectModel<typeof properties>

/** 専用テーブル（properties）の行を JSON ミラー用 data に整形する */
function buildCustomRecordData(p: PropertyRow): Record<string, unknown> {
  const SKIP = new Set(['id', 'created_at', 'updated_at'])
  const data: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(p)) {
    if (SKIP.has(key)) continue
    if (val === null || val === undefined) continue
    // Date 型は YYYY-MM-DD 文字列に
    if (val instanceof Date) {
      data[key] = val.toISOString().split('T')[0]
    } else {
      data[key] = val
    }
  }
  return data
}

/** properties 行を custom_records にミラー（INSERT または UPDATE）
 *  ※ properties テーブルには owner_id カラムが無いため、custom_records.owner_id は null。
 */
export async function syncPropertyToCustomRecord(p: PropertyRow): Promise<void> {
  const objId = await getPropertiesObjectId()
  if (!objId) return  // object_definitions に properties が無ければスキップ

  const data = buildCustomRecordData(p)

  const existing = await db.select({ id: custom_records.id })
    .from(custom_records).where(eq(custom_records.id, p.id))

  if (existing.length > 0) {
    await db.update(custom_records)
      .set({ data, updated_at: new Date() })
      .where(eq(custom_records.id, p.id))
  } else {
    await db.insert(custom_records).values({
      id:        p.id,
      object_id: objId,
      data,
    })
  }
}

/** property 削除時のミラー削除 */
export async function deletePropertyCustomRecord(propertyId: string): Promise<void> {
  await db.delete(custom_records).where(eq(custom_records.id, propertyId))
}

let _cachedObjectId: string | null = null
async function getPropertiesObjectId(): Promise<string | null> {
  if (_cachedObjectId) return _cachedObjectId
  const rows = await db.select({ id: object_definitions.id })
    .from(object_definitions)
    .where(eq(object_definitions.api_name, PROPERTIES_API_NAME))
  _cachedObjectId = rows[0]?.id ?? null
  return _cachedObjectId
}
