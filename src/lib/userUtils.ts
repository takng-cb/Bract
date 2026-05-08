import { unstable_cache } from 'next/cache'
import { db } from './db'
import { users, user_preferences } from './schema'

export const CACHE_TAG_USERS = 'users'

export type UserOption = { id: string; name: string }

/** 全ユーザー一覧（サーバー横断キャッシュ、300秒TTL）
 *  表示名は user_preferences.display_name → users.email の優先順
 *  ※ users.id(uuid) と user_preferences.user_id(text) の型不一致を避けるため
 *    JOIN を使わず 2クエリ + JS マージ
 */
export const getAllUsers = unstable_cache(
  async (): Promise<UserOption[]> => {
    const [userRows, prefRows] = await Promise.all([
      db.select({ id: users.id, email: users.email }).from(users).orderBy(users.email),
      db.select({ user_id: user_preferences.user_id, display_name: user_preferences.display_name }).from(user_preferences),
    ])
    const prefMap = new Map(prefRows.map((p) => [p.user_id, p.display_name]))
    return userRows.map((r) => ({ id: r.id, name: prefMap.get(r.id) ?? r.email }))
  },
  ['all_users'],
  { tags: [CACHE_TAG_USERS], revalidate: 300 },
)
