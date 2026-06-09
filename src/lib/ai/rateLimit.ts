import 'server-only'
/**
 * AI 機能のレート制限（ユーザー単位・濫用/コスト対策）。
 * サーバーレスでも有効なよう DB ベース（ai_rate_log）でカウントする。
 */
import { db } from '@/lib/db'
import { ai_rate_log } from '@/lib/schema'
import { getCurrentUserId } from '@/lib/auth'
import { and, eq, gte, sql } from 'drizzle-orm'

const WINDOW_SEC = 60
const MAX_PER_WINDOW = 20

/** 制限超過は AiRateLimitError として投げる（呼び出し側でメッセージ表示） */
export class AiRateLimitError extends Error {
  constructor() {
    super('AI 機能の利用が短時間に集中しています。少し時間をおいて再度お試しください。')
    this.name = 'AiRateLimitError'
  }
}

/**
 * 直近 WINDOW_SEC 秒で MAX_PER_WINDOW を超えていれば AiRateLimitError。OK ならログを1件追加。
 * フェイルオープン：ai_rate_log 未適用 Neon 等で DB エラーが出た場合は「制限なし」で通す
 *   （AI 機能自体を壊さない）。AiRateLimitError は再送出する。
 */
export async function assertAiRateLimit(): Promise<void> {
  const uid = await getCurrentUserId()
  if (!uid) return // 未ログインは認可側で弾かれる

  try {
    const since = new Date(Date.now() - WINDOW_SEC * 1000)
    const rows = await db.select({ n: sql<number>`count(*)::int` }).from(ai_rate_log)
      .where(and(eq(ai_rate_log.user_id, uid), gte(ai_rate_log.created_at, since)))
    if (Number(rows[0]?.n ?? 0) >= MAX_PER_WINDOW) throw new AiRateLimitError()

    await db.insert(ai_rate_log).values({ user_id: uid })
    await db.delete(ai_rate_log)
      .where(sql`${ai_rate_log.created_at} < now() - interval '1 hour'`)
      .catch(() => {})
  } catch (e) {
    if (e instanceof AiRateLimitError) throw e
    // DB エラー（テーブル未作成等）はフェイルオープン
  }
}
