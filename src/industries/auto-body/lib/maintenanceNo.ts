/**
 * 整備番号 (maintenance_no) 生成ロジック。
 * 形式: 'YYYYMMDD-NNN'（全社で日付内連番、日が変われば 001 リスタート）
 */
import { db } from '@/lib/db'
import { maintenance_records } from '@/lib/schema'
import { sql } from 'drizzle-orm'

function todayPrefix(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * 当日付の最大連番 + 1 を計算して `YYYYMMDD-NNN` を返す。
 * 同時 INSERT で衝突した場合は UNIQUE 違反になるので、呼び出し側で再試行する想定。
 */
export async function generateMaintenanceNo(): Promise<string> {
  const prefix = todayPrefix()
  const pattern = `${prefix}-%`

  const rows = await db.select({ no: maintenance_records.maintenance_no })
    .from(maintenance_records)
    .where(sql`${maintenance_records.maintenance_no} LIKE ${pattern}`)
    .orderBy(sql`${maintenance_records.maintenance_no} DESC`)
    .limit(1)

  let seq = 1
  if (rows.length > 0 && rows[0].no) {
    const parts = rows[0].no.split('-')
    const tail = parts[parts.length - 1]
    const n = Number(tail)
    if (Number.isFinite(n)) seq = n + 1
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`
}
