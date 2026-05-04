'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities, activities, activity_contacts,
  tasks, expenses, properties, taggables, change_logs, attachments,
  users,
} from '@/lib/schema'
import { isAdminUser } from '@/lib/userRole'
import { requireAdmin } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { Role } from '@/lib/userRole'

/** ユーザーのロールを変更する（管理者専用） */
export async function updateUserRole(formData: FormData): Promise<void> {
  await requireAdmin()
  const userId = formData.get('userId') as string
  const role   = formData.get('role') as Role
  if (!userId || !['admin', 'editor', 'viewer'].includes(role)) return
  await db.update(users).set({ role }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}

/**
 * 全ビジネスデータを削除する（管理者専用）
 * user_preferences / system_settings / tags は保持
 */
export async function deleteAllData(): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !(await isAdminUser(user.id))) {
    return { error: '管理者権限がありません' }
  }

  try {
    // FK の依存順に削除（子 → 親）
    await db.delete(taggables)
    await db.delete(change_logs)
    await db.delete(attachments)
    await db.delete(activity_contacts)
    await db.delete(activities)
    await db.delete(tasks)
    await db.delete(expenses)
    await db.delete(properties)
    await db.delete(opportunities)
    await db.delete(contacts)
    await db.delete(accounts)

    return {}
  } catch (e) {
    console.error('deleteAllData error:', e)
    return { error: 'データの削除中にエラーが発生しました' }
  }
}
