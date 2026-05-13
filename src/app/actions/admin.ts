'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities, activities, activity_contacts,
  tasks, expenses, taggables, change_logs, attachments,
  users,
} from '@/lib/schema'
import { isAdminUser } from '@/lib/userRole'
import { requireAdmin, getSupabaseUser } from '@/lib/auth'
import { activeIndustry } from '@/lib/industry'
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
 * ユーザーを完全削除する（管理者専用）。
 *
 * 動作:
 *   1. requireAdmin() で 管理者権限を確認
 *   2. 自分自身は削除不可（誤って管理者がゼロになるのを防ぐ）
 *   3. Supabase Auth から削除（Admin API 経由）
 *   4. public.users テーブルから削除
 *      - users テーブルが他のテーブルから FK 参照されている場合、参照側の
 *        owner_id 等は ON DELETE SET NULL で自動的に NULL になる想定
 *
 * 注意:
 *   - Supabase Auth 側の削除が失敗した場合は public.users の削除も中止
 *   - 戻り値は Server Action として form action で使えるよう void
 *     エラーは throw して呼び出し側で error.tsx に飛ばす
 */
export async function deleteUser(formData: FormData): Promise<void> {
  await requireAdmin()
  const userId = formData.get('userId') as string
  if (!userId) throw new Error('userId is required')

  const me = await getSupabaseUser()
  if (!me) throw new Error('Not authenticated')
  if (userId === me.id) throw new Error('自分自身は削除できません')

  // Supabase Auth から削除
  const adminClient = createSupabaseAdminClient()
  const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
  if (authError) {
    // "User not found" は public.users に残骸がある状態なので削除続行
    if (!/not found/i.test(authError.message)) {
      throw new Error(`Supabase Auth 削除エラー: ${authError.message}`)
    }
  }

  // public.users テーブルから削除
  await db.delete(users).where(eq(users.id, userId))

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
    // 業種オーバーレイ：不動産業の properties テーブルがある環境でのみ削除
    if (activeIndustry === 'real-estate') {
      const { properties } = await import('@/industries/real-estate/schema')
      await db.delete(properties)
    }
    await db.delete(opportunities)
    await db.delete(contacts)
    await db.delete(accounts)

    return {}
  } catch (e) {
    console.error('deleteAllData error:', e)
    return { error: 'データの削除中にエラーが発生しました' }
  }
}
