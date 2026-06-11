/**
 * レコードのゴミ箱（REQ-0047）— サーバー側ヘルパー
 *
 * - 各ブックの削除 action は実削除の直前に trashRecord() を呼び、行全体を退避する。
 * - 復元は jsonb_populate_record で元テーブルに再 INSERT（id 重複時は何もしない）。
 *   子レコード（明細・関連付け junction 等）は v1 では復元対象外。
 * - 閲覧権限: 管理者=全件、一般ユーザー=自分が削除したものだけ。
 * - 保持期限（system_settings `trash_retention_days`、既定30日）を過ぎた行は
 *   一覧表示のタイミングで自動削除する。
 */
import 'server-only'
import { db } from '@/lib/db'
import { trash_records, system_settings } from '@/lib/schema'
import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { getCurrentUserId } from '@/lib/auth'
import { getCurrentPermissions } from '@/lib/permissions'

/** 復元可能な物理テーブルの whitelist（表示名つき）。ここに無いものは復元不可 */
export const TRASH_TABLES: Record<string, string> = {
  accounts:            '取引先',
  contacts:            '人物',
  opportunities:       '商談',
  activities:          '活動履歴',
  tasks:               'ToDo',
  expenses:            '経費',
  products:            '商品',
  warehouses:          '倉庫',
  wiki_pages:          'Wiki',
  customer_vehicles:   '顧客車両',
  maintenance_records: '整備',
  parts:               '部品',
  vehicles:            '車両',
  properties:          '物件',
  assignments:         '案件',
  staff:               'スタッフ',
  book_records:      'カスタムレコード',
}

const LABEL_KEYS = ['name', 'title', 'full_name', 'subject', 'maintenance_no', 'assignment_no', 'plate_number', 'license_plate', 'slug']

function deriveLabel(payload: Record<string, unknown>): string {
  for (const k of LABEL_KEYS) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  // book_records は data JSON の name/title
  const data = payload.data as Record<string, unknown> | undefined
  if (data) {
    for (const k of ['name', 'title']) {
      const v = data[k]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  const id = payload.id
  return typeof id === 'string' ? `#${id.slice(0, 8)}` : '（無題）'
}

/**
 * レコードをゴミ箱へ退避する（**実削除の直前に呼ぶ**。行が無ければ何もしない）。
 * @param tableName TRASH_TABLES のキー（物理テーブル名）
 * @param objectLabel 表示用ブック名の上書き（カスタムブック等。省略時は whitelist の表示名）
 */
export async function trashRecord(tableName: string, id: string, objectLabel?: string): Promise<void> {
  if (!TRASH_TABLES[tableName]) return  // whitelist 外は退避しない（メタテーブル等）
  const res = await db.execute(
    sql`SELECT to_jsonb(t.*) AS payload FROM ${sql.identifier(tableName)} t WHERE t.id = ${id}`,
  )
  const payload = (res.rows?.[0] as { payload?: Record<string, unknown> } | undefined)?.payload
  if (!payload) return
  const userId = await getCurrentUserId()
  await db.insert(trash_records).values({
    object_type:  tableName,
    object_label: objectLabel ?? TRASH_TABLES[tableName],
    record_id:    id,
    label:        deriveLabel(payload),
    payload,
    deleted_by:   userId,
  })
}

/** 保持日数（既定30日。0 以下は 30 に丸める） */
async function retentionDays(): Promise<number> {
  const row = await db.select({ value: system_settings.value })
    .from(system_settings).where(eq(system_settings.key, 'trash_retention_days'))
    .then((r) => r[0] ?? null)
  const n = Number(row?.value ?? 30)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 30
}

/** 保持期限切れの自動削除（一覧表示時に呼ぶ） */
export async function purgeExpiredTrash(): Promise<void> {
  const days = await retentionDays()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  await db.delete(trash_records).where(lt(trash_records.deleted_at, cutoff))
}

export type TrashRow = typeof trash_records.$inferSelect

/** ゴミ箱一覧（管理者=全件 / 一般=自分が削除したもののみ） */
export async function listTrash(): Promise<{ rows: TrashRow[]; isAdmin: boolean; retention: number }> {
  await purgeExpiredTrash()
  const [userId, perms, retention] = await Promise.all([
    getCurrentUserId(), getCurrentPermissions(), retentionDays(),
  ])
  const rows = await db.select().from(trash_records)
    .where(perms.isAdmin ? undefined : and(eq(trash_records.deleted_by, userId ?? '')))
    .orderBy(desc(trash_records.deleted_at))
    .limit(200)
  return { rows, isAdmin: perms.isAdmin, retention }
}

/** 復元/完全削除の権限（管理者 or 削除した本人） */
export async function canTouchTrash(row: TrashRow): Promise<boolean> {
  const [userId, perms] = await Promise.all([getCurrentUserId(), getCurrentPermissions()])
  return perms.isAdmin || (!!userId && row.deleted_by === userId)
}

/** 元テーブルへ再 INSERT（id 重複時は何もしない=false を返す） */
export async function restoreRow(row: TrashRow): Promise<boolean> {
  const tableName = row.object_type
  if (!TRASH_TABLES[tableName]) throw new Error(`復元できないテーブルです: ${tableName}`)
  await db.execute(sql`
    INSERT INTO ${sql.identifier(tableName)}
    SELECT * FROM jsonb_populate_record(NULL::${sql.identifier(tableName)}, ${JSON.stringify(row.payload)}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `)
  const check = await db.execute(
    sql`SELECT 1 FROM ${sql.identifier(tableName)} WHERE id = ${row.record_id} LIMIT 1`,
  )
  return (check.rows?.length ?? 0) > 0
}
