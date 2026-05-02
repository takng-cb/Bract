'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities, activities, activity_contacts,
  tasks, expenses, properties, taggables, change_logs, attachments,
} from '@/lib/schema'

/** t_noguchi のメールアドレスかどうか確認 */
function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const username = email.split('@')[0].toLowerCase()
  return username === 't_noguchi'
}

/**
 * 全ビジネスデータを削除する（管理者専用）
 * user_preferences / system_settings / tags は保持
 */
export async function deleteAllData(): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
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
