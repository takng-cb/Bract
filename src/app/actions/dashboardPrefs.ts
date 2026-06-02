'use server'

/**
 * ダッシュボードウィジェット設定の保存 Server Action (ベース機能)
 *
 * 認証済みユーザー自身の user_preferences.dashboard_widgets を更新する。
 */
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUserId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { DashboardWidgetPrefs } from '@/lib/dashboard/widgets'

export async function updateDashboardWidgetPrefs(
  prefs: DashboardWidgetPrefs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId()
  if (!userId) return { ok: false, error: '認証が必要です' }

  try {
    // upsert
    const existing = await db.select({ id: user_preferences.id })
      .from(user_preferences)
      .where(eq(user_preferences.user_id, userId))
      .limit(1)

    if (existing.length > 0) {
      await db.update(user_preferences)
        .set({ dashboard_widgets: prefs, updated_at: new Date() })
        .where(eq(user_preferences.user_id, userId))
    } else {
      await db.insert(user_preferences).values({
        user_id:           userId,
        dashboard_widgets: prefs,
      })
    }

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
