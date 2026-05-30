/**
 * assignment_no 発番ユーティリティ (Issue #69)
 *
 * DB 依存があるため staffingService.ts (純粋関数のみ) と分離。
 */
import { db } from '@/lib/db'
import { assignments } from '@/lib/schema'
import { sql, like } from 'drizzle-orm'

/**
 * 'YYYYMMDD-NNN' 形式の発番。同日内で連番。
 */
export async function generateAssignmentNo(): Promise<string> {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const prefix = `${y}${m}${d}`

  const rows = await db.select({ no: assignments.assignment_no })
    .from(assignments)
    .where(like(assignments.assignment_no, `${prefix}-%`))
    .orderBy(sql`${assignments.assignment_no} DESC`)
    .limit(1)

  let next = 1
  if (rows.length > 0) {
    const last = rows[0].no.split('-')[1]
    next = parseInt(last, 10) + 1
  }
  return `${prefix}-${String(next).padStart(3, '0')}`
}
