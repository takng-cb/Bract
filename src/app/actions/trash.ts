'use server'

/**
 * ゴミ箱の操作（REQ-0047）。
 * 復元・完全削除とも「管理者 or 削除した本人」のみ。
 */
import { db } from '@/lib/db'
import { trash_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canTouchTrash, restoreRow } from '@/lib/trash'

export async function restoreTrashRecord(id: string): Promise<void> {
  const row = await db.select().from(trash_records).where(eq(trash_records.id, id)).then((r) => r[0] ?? null)
  if (!row) throw new Error('ゴミ箱にレコードが見つかりません')
  if (!(await canTouchTrash(row))) throw new Error('復元できるのは管理者または削除した本人のみです')

  const restored = await restoreRow(row)
  if (!restored) throw new Error('復元先に同じ ID のレコードが既に存在します')

  await db.delete(trash_records).where(eq(trash_records.id, id))
  revalidatePath('/trash')
  revalidatePath('/', 'layout')
}

/** ゴミ箱からの完全削除（復元不可になる） */
export async function purgeTrashRecord(id: string): Promise<void> {
  const row = await db.select().from(trash_records).where(eq(trash_records.id, id)).then((r) => r[0] ?? null)
  if (!row) return
  if (!(await canTouchTrash(row))) throw new Error('完全削除できるのは管理者または削除した本人のみです')
  await db.delete(trash_records).where(eq(trash_records.id, id))
  revalidatePath('/trash')
}
