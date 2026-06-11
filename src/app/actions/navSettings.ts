'use server'

import { db } from '@/lib/db'
import { user_preferences, system_settings } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { parseNavOrder, type NavOrderV2 } from '@/lib/navOrder'

// ----------------------------------------------------------------
// 設定ページ用：ユーザー設定とシステム設定の両方を返す
// v2（モジュール＋ブックの2階層）/ 旧フラット配列の両方をパース済みで返す
// ----------------------------------------------------------------
export async function getNavOrderSettings(): Promise<{
  userOrder:   NavOrderV2 | string[] | null
  systemOrder: NavOrderV2 | string[] | null
}> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    let userOrder: NavOrderV2 | string[] | null = null
    if (user) {
      const row = await db.select({ nav_order: user_preferences.nav_order })
        .from(user_preferences)
        .where(eq(user_preferences.user_id, user.id))
        .then((r) => r[0] ?? null)
      userOrder = parseNavOrder(row?.nav_order)
    }

    const sys = await db.select({ value: system_settings.value })
      .from(system_settings)
      .where(eq(system_settings.key, 'nav_order'))
      .then((r) => r[0] ?? null)
    const systemOrder = parseNavOrder(sys?.value)

    return { userOrder, systemOrder }
  } catch {
    return { userOrder: null, systemOrder: null }
  }
}

// ----------------------------------------------------------------
// ユーザー個人のナビ順序を保存（v2 オブジェクト / 旧フラット配列の両対応）
// ----------------------------------------------------------------
export async function saveUserNavOrder(order: NavOrderV2 | string[]): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await db.insert(user_preferences)
    .values({ user_id: user.id, nav_order: JSON.stringify(order) })
    .onConflictDoUpdate({
      target: user_preferences.user_id,
      set:    { nav_order: JSON.stringify(order), updated_at: new Date() },
    })

  revalidatePath('/', 'layout')
}

// ----------------------------------------------------------------
// ユーザー個人の設定をリセット（システムデフォルトに戻す）
// ----------------------------------------------------------------
export async function resetUserNavOrder(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await db.delete(user_preferences)
    .where(eq(user_preferences.user_id, user.id))

  revalidatePath('/', 'layout')
}

// ----------------------------------------------------------------
// システム全体のデフォルト順序を保存
// ----------------------------------------------------------------
export async function saveSystemNavOrder(order: NavOrderV2 | string[]): Promise<void> {
  await requireAdmin()
  await db.insert(system_settings)
    .values({ key: 'nav_order', value: JSON.stringify(order) })
    .onConflictDoUpdate({
      target: system_settings.key,
      set:    { value: JSON.stringify(order), updated_at: new Date() },
    })

  revalidatePath('/', 'layout')
}

// ----------------------------------------------------------------
// システム設定をデフォルトにリセット
// ----------------------------------------------------------------
export async function resetSystemNavOrder(): Promise<void> {
  await requireAdmin()
  await db.delete(system_settings)
    .where(eq(system_settings.key, 'nav_order'))

  revalidatePath('/', 'layout')
}
