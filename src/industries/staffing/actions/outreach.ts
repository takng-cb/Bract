'use server'

/**
 * outreach（打診 / RFQ）アクション — staffing（REQ-0005 / spec §3-4）
 *
 * 複数の紹介会社へ打診を記録し、状態（打診済/返信待ち/候補あり/該当なし）を管理する。
 * 最初の打診で案件ステータスを「打診中」へ自動遷移させる。
 */
import { db } from '@/lib/db'
import { outreach, assignments } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { ensureModuleEnabled } from '@/lib/modules/registry'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'

/** 案件ステータスを前進だけさせる（後退・終了状態は触らない） */
async function advanceAssignmentStatus(assignmentId: string, to: string, from: string[]) {
  const [a] = await db.select({ status: assignments.status }).from(assignments).where(eq(assignments.id, assignmentId)).limit(1)
  if (a && from.includes(a.status)) {
    await db.update(assignments).set({ status: to, updated_at: new Date() }).where(eq(assignments.id, assignmentId))
  }
}

export async function createOutreach(assignmentId: string, agencyAccountId: string, notes?: string | null) {
  await requirePermission('assignments', 'create')
  await ensureModuleEnabled('staffing')
  if (!assignmentId) throw new Error('案件が指定されていません')
  if (!agencyAccountId) throw new Error('打診先（紹介会社）を選択してください')

  await db.insert(outreach).values({
    assignment_id:     assignmentId,
    agency_account_id: agencyAccountId,
    status:            '打診済',
    sent_at:           new Date(),
    notes:             notes?.trim() || null,
  })
  await advanceAssignmentStatus(assignmentId, '打診中', ['受付', '予約'])
  revalidatePath(`/assignments/${assignmentId}`)
}

export async function updateOutreachStatus(id: string, assignmentId: string, status: string) {
  await requirePermission('assignments', 'update')
  await ensureModuleEnabled('staffing')
  await db.update(outreach).set({ status }).where(eq(outreach.id, id))
  revalidatePath(`/assignments/${assignmentId}`)
}

export async function deleteOutreach(id: string, assignmentId: string) {
  await requirePermission('assignments', 'delete')
  await ensureModuleEnabled('staffing')
  await db.delete(outreach).where(eq(outreach.id, id))
  revalidatePath(`/assignments/${assignmentId}`)
}
