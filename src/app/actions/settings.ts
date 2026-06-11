'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { user_preferences, system_settings } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { SYSTEM_DEFAULTS, type SystemSettingKey } from '@/lib/systemSettings'
import { requireAdmin } from '@/lib/auth'

// ----------------------------------------------------------------
// パスワード変更
// ----------------------------------------------------------------
export async function updatePassword(
  _: string | null,
  formData: FormData
): Promise<string | null> {
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm') as string

  // パスワード最低文字数をシステム設定から取得
  const minRow = await db.select({ value: system_settings.value })
    .from(system_settings)
    .where(eq(system_settings.key, 'password_min_length'))
    .then((r) => r[0] ?? null)
  const minLen = parseInt(minRow?.value ?? SYSTEM_DEFAULTS.password_min_length, 10)

  if (!password || password.length < minLen)
    return `error:パスワードは${minLen}文字以上で入力してください`
  if (password !== confirm)
    return 'error:パスワードが一致しません'

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return `error:パスワードの更新に失敗しました（${error.message}）`
  return 'success'
}

// ----------------------------------------------------------------
// プロフィール（表示名）更新
// ----------------------------------------------------------------
export async function updateProfile(
  _: string | null,
  formData: FormData
): Promise<string | null> {
  const display_name = (formData.get('display_name') as string).trim()

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'error:認証が必要です'

  await db.insert(user_preferences)
    .values({ user_id: user.id, display_name })
    .onConflictDoUpdate({
      target: user_preferences.user_id,
      set:    { display_name, updated_at: new Date() },
    })

  revalidatePath('/', 'layout')
  return 'success'
}

// ----------------------------------------------------------------
// システム設定の保存
// ----------------------------------------------------------------
export async function saveSystemSettings(
  _: string | null,
  formData: FormData
): Promise<string | null> {
  await requireAdmin()
  const keys: SystemSettingKey[] = [
    'company_name',
    'password_min_length',
    'session_timeout_minutes',
    'allow_self_registration',
    'fiscal_year_start',
  ]

  try {
    for (const key of keys) {
      const raw = formData.get(key)
      if (raw === null) continue
      const value = (raw as string).trim()

      // バリデーション
      if (key === 'password_min_length') {
        const n = parseInt(value, 10)
        if (isNaN(n) || n < 6 || n > 128)
          return 'error:パスワード最低文字数は6〜128の範囲で設定してください'
      }
      if (key === 'session_timeout_minutes') {
        const n = parseInt(value, 10)
        if (isNaN(n) || n < 0)
          return 'error:セッションタイムアウトは0以上の整数を入力してください'
      }
      if (key === 'fiscal_year_start') {
        const n = parseInt(value, 10)
        if (isNaN(n) || n < 1 || n > 12)
          return 'error:会計年度開始月は1〜12の範囲で設定してください'
      }

      await db.insert(system_settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: system_settings.key,
          set:    { value, updated_at: new Date() },
        })
    }
  } catch (e) {
    return `error:保存に失敗しました（${(e as Error).message}）`
  }

  revalidatePath('/', 'layout')
  return 'success'
}

// ────────────────────────────────────────────────────────────────
// 商談の商品候補ブック設定（REQ-0034・管理者のみ）
// ────────────────────────────────────────────────────────────────
export async function saveOpportunityProductBooks(formData: FormData): Promise<void> {
  const { requireAdmin } = await import('@/lib/auth')
  await requireAdmin()
  const books = (formData.getAll('books') as string[]).map((b) => b.trim()).filter(Boolean)
  const value = JSON.stringify(books.length > 0 ? books : ['products', 'parts'])
  await db.insert(system_settings)
    .values({ key: 'opportunity_product_books', value })
    .onConflictDoUpdate({ target: system_settings.key, set: { value } })
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/books')
}

// ────────────────────────────────────────────────────────────────
// ボードの終端列ウィンドウ（REQ-0044・管理者のみ）
//   受注/失注/完了の列をボードで直近Nヶ月に絞る。0 = 無制限
// ────────────────────────────────────────────────────────────────
export async function saveBoardClosedWindow(formData: FormData): Promise<void> {
  await requireAdmin()
  const months = Math.max(0, Math.trunc(Number(formData.get('months') ?? 3)) || 0)
  await db.insert(system_settings)
    .values({ key: 'board_closed_window_months', value: String(months) })
    .onConflictDoUpdate({ target: system_settings.key, set: { value: String(months), updated_at: new Date() } })
  revalidatePath('/', 'layout')
}

// ────────────────────────────────────────────────────────────────
// モバイル下部タブの設定（REQ-0041・管理者のみ）
//   formData: slot_1..slot_4 = href（中央 FAB は固定のため4枠）
// ────────────────────────────────────────────────────────────────
export async function saveMobileBottomNav(formData: FormData): Promise<void> {
  await requireAdmin()
  const slots = [1, 2, 3, 4]
    .map((i) => ((formData.get(`slot_${i}`) as string) ?? '').trim())
    .filter((h) => /^\/[a-z0-9/_-]*$/i.test(h))
  if (slots.length !== 4 || new Set(slots).size !== 4) {
    throw new Error('下部タブは重複なしの4つを選択してください')
  }
  await db.insert(system_settings)
    .values({ key: 'mobile_bottom_nav', value: JSON.stringify(slots) })
    .onConflictDoUpdate({ target: system_settings.key, set: { value: JSON.stringify(slots), updated_at: new Date() } })
  revalidatePath('/', 'layout')
}
