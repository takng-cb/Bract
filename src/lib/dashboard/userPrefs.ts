/**
 * ダッシュボードウィジェット設定の DB 取得 (ベース機能)
 *
 * Server Component から呼び出してユーザー単位の設定を取得する。
 */
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import type { DashboardWidgetPrefs } from './widgets'

/**
 * 指定ユーザーのダッシュボードウィジェット設定を返す。
 * 未設定なら null (各 widget の defaultEnabled が使われる)。
 */
export const getDashboardWidgetPrefs = cache(async (userId: string | null): Promise<DashboardWidgetPrefs | null> => {
  if (!userId) return null
  try {
    const rows = await db.select({ dashboard_widgets: user_preferences.dashboard_widgets })
      .from(user_preferences)
      .where(eq(user_preferences.user_id, userId))
      .limit(1)
    const raw = rows[0]?.dashboard_widgets
    if (!raw) return null
    return raw as DashboardWidgetPrefs
  } catch {
    return null
  }
})
