import { unstable_cache } from 'next/cache'
import { db } from './db'
import { users, user_preferences } from './schema'
import { eq } from 'drizzle-orm'

export const CACHE_TAG_USERS = 'users'

export type UserOption = { id: string; name: string }

/** 全ユーザー一覧（サーバー横断キャッシュ、300秒TTL）
 *  表示名は user_preferences.display_name → users.email の優先順
 */
export const getAllUsers = unstable_cache(
  async (): Promise<UserOption[]> => {
    const rows = await db
      .select({
        id:           users.id,
        email:        users.email,
        display_name: user_preferences.display_name,
      })
      .from(users)
      .leftJoin(user_preferences, eq(users.id, user_preferences.user_id))
      .orderBy(users.email)
    return rows.map((r) => ({ id: r.id, name: r.display_name ?? r.email }))
  },
  ['all_users'],
  { tags: [CACHE_TAG_USERS], revalidate: 300 },
)
