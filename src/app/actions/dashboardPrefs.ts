'use server'

/**
 * ダッシュボードウィジェット設定の保存 Server Action (ベース機能)
 *
 * 認証済みユーザー自身の user_preferences.dashboard_widgets を更新する。
 * scope 化（#105）: 'global'（/dashboard）と 'module:<id>'（モジュールホーム）を
 * 同じ jsonb 内に保存する。旧フラット形式は保存時に scoped 形式へ移行する
 * （既存のグローバル設定は global キーへ温存。scopedPrefs.ts 参照）。
 */
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUserId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import {
  mergeWidgetPrefsScope,
  WIDGET_PREFS_GLOBAL_SCOPE,
  WIDGET_PREFS_MODULE_PREFIX,
} from '@/lib/dashboard/scopedPrefs'

export async function updateDashboardWidgetPrefs(
  prefs: DashboardWidgetPrefs,
  scope: string = WIDGET_PREFS_GLOBAL_SCOPE,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId()
  if (!userId) return { ok: false, error: '認証が必要です' }

  // scope キーの検証（widget id と衝突しない予約形式のみ受け付ける）
  if (scope !== WIDGET_PREFS_GLOBAL_SCOPE && !scope.startsWith(WIDGET_PREFS_MODULE_PREFIX)) {
    return { ok: false, error: `不正な scope です: ${scope}` }
  }

  try {
    // upsert（既存 jsonb に scope 分だけマージして他 scope の設定を保持する）
    const existing = await db.select({
      id:                user_preferences.id,
      dashboard_widgets: user_preferences.dashboard_widgets,
    })
      .from(user_preferences)
      .where(eq(user_preferences.user_id, userId))
      .limit(1)

    const merged = mergeWidgetPrefsScope(existing[0]?.dashboard_widgets ?? null, scope, prefs)

    if (existing.length > 0) {
      await db.update(user_preferences)
        .set({ dashboard_widgets: merged, updated_at: new Date() })
        .where(eq(user_preferences.user_id, userId))
    } else {
      await db.insert(user_preferences).values({
        user_id:           userId,
        dashboard_widgets: merged,
      })
    }

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    if (scope.startsWith(WIDGET_PREFS_MODULE_PREFIX)) {
      revalidatePath(`/modules/${scope.slice(WIDGET_PREFS_MODULE_PREFIX.length)}`)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
