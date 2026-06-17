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
import { logChanges } from '@/lib/changeLog'
import { GRANTABLE_OBJECTS } from '@/lib/recordGrants'

/**
 * 外部ユーザーへレコードを共有（付与）。Phase3: 有効期限＋監査ログ。
 * @param expiresInDays 0/未指定で無期限。>0 で N 日後に失効。
 */
export async function grantRecordToExternal(
  objectApi: string, recordId: string, granteeId: string, revalidate?: string, expiresInDays?: number,
): Promise<void> {
  await requireAdmin()
  if (!(GRANTABLE_OBJECTS as readonly string[]).includes(objectApi)) throw new Error('このオブジェクトは外部共有に未対応です')

  // 付与先は外部ユーザーに限る（社内ユーザーへ grant を作らない）
  const [g] = await db.select({ is_external: users.is_external, email: users.email }).from(users).where(eq(users.id, granteeId))
  if (!g) throw new Error('ユーザーが見つかりません')
  if (!g.is_external) throw new Error('外部ユーザーにのみ共有できます')

  const me = await getCurrentUserId()
  const expiresAt = expiresInDays && expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86400000) : null

  // 再共有時は期限を更新（DoNothing だと期限変更が効かないため Upsert）
  await db.insert(record_grants).values({
    object_api: objectApi, record_id: recordId, grantee_id: granteeId, level: 'read', granted_by: me ?? null, expires_at: expiresAt,
  }).onConflictDoUpdate({
    target: [record_grants.object_api, record_grants.record_id, record_grants.grantee_id],
    set: { expires_at: expiresAt, granted_by: me ?? null },
  })

  // 監査ログ（レコード履歴 / 監査ログ画面に表示。REQ-0084 Phase3）
  const expLabel = expiresAt ? `（期限 ${expiresAt.toISOString().slice(0, 10)}）` : '（無期限）'
  await logChanges(objectApi, recordId,
    { external_share: { label: '外部共有', value: null } },
    { external_share: { label: '外部共有', value: `付与 → ${g.email}${expLabel}` } },
  )

  if (revalidate) revalidatePath(revalidate)
}

export async function revokeRecordGrant(
  objectApi: string, recordId: string, granteeId: string, revalidate?: string,
): Promise<void> {
  await requireAdmin()
  const [g] = await db.select({ email: users.email }).from(users).where(eq(users.id, granteeId))
  await db.delete(record_grants).where(and(
    eq(record_grants.object_api, objectApi),
    eq(record_grants.record_id, recordId),
    eq(record_grants.grantee_id, granteeId),
  ))
  await logChanges(objectApi, recordId,
    { external_share: { label: '外部共有', value: null } },
    { external_share: { label: '外部共有', value: `取消（${g?.email ?? granteeId}）` } },
  )
  if (revalidate) revalidatePath(revalidate)
}
