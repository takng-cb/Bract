'use server'

/**
 * record_grants（外部ユーザーへのレコード共有）の作成/取消（REQ-0084 / ADR-0029・Phase2）。
 * Phase2 は管理者のみが付与/取消できる（Phase3 でレコード所有者へ委譲予定）。
 * 共有グラフの「子の選択」UI は Phase3。ここは単一レコードの付与/取消のみ。
 */
import { db } from '@/lib/db'
import { record_grants, users } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { requireAdmin, getCurrentUserId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { GRANTABLE_OBJECTS } from '@/lib/recordGrants'

export async function grantRecordToExternal(
  objectApi: string, recordId: string, granteeId: string, revalidate?: string,
): Promise<void> {
  await requireAdmin()
  if (!(GRANTABLE_OBJECTS as readonly string[]).includes(objectApi)) throw new Error('このオブジェクトは外部共有に未対応です')

  // 付与先は外部ユーザーに限る（社内ユーザーへ grant を作らない）
  const [g] = await db.select({ is_external: users.is_external }).from(users).where(eq(users.id, granteeId))
  if (!g) throw new Error('ユーザーが見つかりません')
  if (!g.is_external) throw new Error('外部ユーザーにのみ共有できます')

  const me = await getCurrentUserId()
  await db.insert(record_grants).values({
    object_api: objectApi, record_id: recordId, grantee_id: granteeId, level: 'read', granted_by: me ?? null,
  }).onConflictDoNothing()

  if (revalidate) revalidatePath(revalidate)
}

export async function revokeRecordGrant(
  objectApi: string, recordId: string, granteeId: string, revalidate?: string,
): Promise<void> {
  await requireAdmin()
  await db.delete(record_grants).where(and(
    eq(record_grants.object_api, objectApi),
    eq(record_grants.record_id, recordId),
    eq(record_grants.grantee_id, granteeId),
  ))
  if (revalidate) revalidatePath(revalidate)
}
