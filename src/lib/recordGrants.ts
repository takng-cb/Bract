/**
 * record_grants（外部ユーザーへのレコード個別共有・per-record ACL）の読み取りヘルパ。
 * REQ-0084 / ADR-0029・Phase2。
 *
 * object_api は record_links / 関連レコードと同じ単数規約（'account' / 'opportunity' /
 * 'project' / 'contact' 等）を用い、resolveRelatedRecords / recordHref と整合させる。
 *
 * 外部ユーザーはブック権限ゼロ（permissions.ts EXTERNAL_DENY）。可視判定はここの grant のみ。
 */
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { record_grants } from '@/lib/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'

/** Phase2 で外部共有できるオブジェクト（単数 api・resolveRelatedRecords と整合）。 */
export const GRANTABLE_OBJECTS = ['account', 'contact', 'opportunity', 'project'] as const

export type Grant = {
  object_api: string
  record_id:  string
  level:      string
  expires_at: Date | null
}

/** 期限切れでない grant のみ（expires_at が NULL または未来）。nowMs は呼び出し側から渡す。 */
function notExpiredCond(nowMs: number) {
  return or(isNull(record_grants.expires_at), gt(record_grants.expires_at, new Date(nowMs)))
}

/** 指定ユーザーに付与された有効な grant の一覧（新しい順）。 */
export async function listGrantsForUser(userId: string): Promise<Grant[]> {
  const now = Date.now()
  return db
    .select({
      object_api: record_grants.object_api,
      record_id:  record_grants.record_id,
      level:      record_grants.level,
      expires_at: record_grants.expires_at,
    })
    .from(record_grants)
    .where(and(eq(record_grants.grantee_id, userId), notExpiredCond(now)))
    .orderBy(record_grants.created_at)
}

/** 指定レコードに対する有効な grant があるか（外部ユーザーのポータル可視判定）。 */
export const userHasGrant = cache(async (objectApi: string, recordId: string, userId: string): Promise<boolean> => {
  const now = Date.now()
  const rows = await db
    .select({ record_id: record_grants.record_id })
    .from(record_grants)
    .where(and(
      eq(record_grants.object_api, objectApi),
      eq(record_grants.record_id, recordId),
      eq(record_grants.grantee_id, userId),
      notExpiredCond(now),
    ))
    .limit(1)
  return rows.length > 0
})

/** 指定レコードを共有している外部ユーザー一覧（社内の共有パネル表示用）。 */
export async function listGranteesForRecord(objectApi: string, recordId: string): Promise<{ grantee_id: string; level: string; expires_at: Date | null }[]> {
  return db
    .select({ grantee_id: record_grants.grantee_id, level: record_grants.level, expires_at: record_grants.expires_at })
    .from(record_grants)
    .where(and(eq(record_grants.object_api, objectApi), eq(record_grants.record_id, recordId)))
}
