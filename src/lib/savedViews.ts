import { db } from './db'
import { saved_views } from './schema'
import { and, eq, or } from 'drizzle-orm'

export type SavedView = {
  id: string
  object_type: string
  name: string
  filter_params: string[]  // parsed from JSON
  group_params: string     // comma-separated, matches ?group= param
  sort_params: string      // "field:asc,field2:desc"
  scope: 'user' | 'system'
  user_id: string | null
  is_default: boolean
}

function parseRow(r: typeof saved_views.$inferSelect): SavedView {
  return {
    id:            r.id,
    object_type:   r.object_type,
    name:          r.name,
    filter_params: JSON.parse(r.filter_params) as string[],
    group_params:  r.group_params,
    sort_params:   (r as Record<string, unknown>).sort_params as string ?? '',
    scope:         r.scope as 'user' | 'system',
    user_id:       r.user_id,
    is_default:    r.is_default,
  }
}

/** 指定オブジェクトのビューを取得（自分のユーザービュー + システムビュー） */
export async function getSavedViews(objectType: string, userId: string | null): Promise<SavedView[]> {
  let rows: (typeof saved_views.$inferSelect)[]

  if (userId) {
    rows = await db.select().from(saved_views).where(
      and(
        eq(saved_views.object_type, objectType),
        or(
          eq(saved_views.scope, 'system'),
          and(eq(saved_views.scope, 'user'), eq(saved_views.user_id, userId)),
        ),
      ),
    ).orderBy(saved_views.created_at)
  } else {
    rows = await db.select().from(saved_views).where(
      and(
        eq(saved_views.object_type, objectType),
        eq(saved_views.scope, 'system'),
      ),
    ).orderBy(saved_views.created_at)
  }

  return rows.map(parseRow)
}

/**
 * デフォルトビューを返す（優先順位: ユーザーデフォルト > システムデフォルト）
 * 何もなければ null
 */
export async function getDefaultView(objectType: string, userId: string | null): Promise<SavedView | null> {
  const views = await getSavedViews(objectType, userId)
  if (userId) {
    const userDefault = views.find((v) => v.scope === 'user' && v.is_default)
    if (userDefault) return userDefault
  }
  return views.find((v) => v.scope === 'system' && v.is_default) ?? null
}
