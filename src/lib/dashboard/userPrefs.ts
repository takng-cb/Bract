/**
 * ダッシュボードウィジェット設定の DB 取得 (ベース機能)
 *
 * Server Component から呼び出してユーザー単位の設定を取得する。
 * jsonb は scope 化されている（旧フラット形式との互換は scopedPrefs.ts 参照）。
 */
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import type { DashboardWidgetPrefs } from './widgets'
import { resolveWidgetPrefsScope, WIDGET_PREFS_GLOBAL_SCOPE } from './scopedPrefs'

/** jsonb の生値（scoped or 旧フラット）をリクエスト内キャッシュで 1 回だけ読む */
const getRawDashboardWidgets = cache(async (userId: string): Promise<unknown> => {
  try {
    const rows = await db.select({ dashboard_widgets: user_preferences.dashboard_widgets })
      .from(user_preferences)
      .where(eq(user_preferences.user_id, userId))
      .limit(1)
    return rows[0]?.dashboard_widgets ?? null
  } catch {
    return null
  }
})

/**
 * 指定ユーザーのダッシュボードウィジェット設定を返す。
 * - scope 省略時は 'global'（/dashboard 用、従来と同じ挙動）
 * - モジュールホームは scope='module:<id>' を渡す
 * 未設定なら null (各 widget の defaultEnabled が使われる)。
 */
export async function getDashboardWidgetPrefs(
  userId: string | null,
  scope: string = WIDGET_PREFS_GLOBAL_SCOPE,
): Promise<DashboardWidgetPrefs | null> {
  if (!userId) return null
  const raw = await getRawDashboardWidgets(userId)
  return resolveWidgetPrefsScope(raw, scope)
}
