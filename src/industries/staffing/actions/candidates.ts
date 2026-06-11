'use server'

/**
 * 候補（assignment_staff）アクション — staffing（REQ-0005 / spec §3-4 / ADR-0010）
 *
 * 紹介会社からの候補を集約・比較し、確定/辞退する。提示単価(proposed_rate)は案件固定単価。
 * 未登録の候補は talent_name から staff レコードを自動作成/再利用して FK を満たす
 * （assignment_staff.staff_id は NOT NULL のため）。
 */
import { db } from '@/lib/db'
import { assignment_staff, assignments, staff } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { ensureModuleEnabled } from '@/lib/modules/registry'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'

async function advanceAssignmentStatus(assignmentId: string, to: string, from: string[]) {
  const [a] = await db.select({ status: assignments.status }).from(assignments).where(eq(assignments.id, assignmentId)).limit(1)
  if (a && from.includes(a.status)) {
    await db.update(assignments).set({ status: to, updated_at: new Date() }).where(eq(assignments.id, assignmentId))
  }
}

/** talent_name（＋紹介会社）から staff を再利用 or 新規作成して id を返す */
async function resolveStaffId(talentName: string, agencyAccountId: string | null): Promise<string> {
  const name = talentName.trim()
  const conds = [eq(staff.name, name)]
  if (agencyAccountId) conds.push(eq(staff.belong_account_id, agencyAccountId))
  const [existing] = await db.select({ id: staff.id }).from(staff).where(and(...conds)).limit(1)
  if (existing) return existing.id
  const [created] = await db.insert(staff).values({
    name,
    belong_account_id: agencyAccountId,
    status: '稼働中',
  }).returning({ id: staff.id })
  return created.id
}

export type AddCandidateInput = {
  agency_account_id?: string | null
  staff_id?: string | null      // 登録済み人材を指定する場合
  talent_name?: string | null   // 未登録の候補名（staff_id 未指定時に使用）
  proposed_rate?: number | null // 提示単価（案件固定）
  notes?: string | null
}

export async function addCandidate(assignmentId: string, input: AddCandidateInput) {
  await requirePermission('assignments', 'create')
  await ensureModuleEnabled('staffing')
  if (!assignmentId) throw new Error('案件が指定されていません')

  const agencyId = input.agency_account_id || null
  let staffId = input.staff_id || null
  let talentName = (input.talent_name ?? '').trim() || null

  if (!staffId) {
    if (!talentName) throw new Error('登録済み人材を選ぶか、候補者名を入力してください')
    staffId = await resolveStaffId(talentName, agencyId)
  } else if (!talentName) {
    const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffId)).limit(1)
    talentName = s?.name ?? null
  }

  await db.insert(assignment_staff).values({
    assignment_id:     assignmentId,
    staff_id:          staffId,
    agency_account_id: agencyId,
    proposed_rate:     input.proposed_rate != null ? String(input.proposed_rate) : null,
    talent_name:       talentName,
    candidate_status:  '候補',
    status:            '予約',
    notes:             input.notes?.trim() || null,
  })
  await advanceAssignmentStatus(assignmentId, '候補集約', ['受付', '予約', '打診中'])
  revalidatePath(`/assignments/${assignmentId}`)
}

export async function confirmCandidate(id: string, assignmentId: string) {
  await requirePermission('assignments', 'update')
  await ensureModuleEnabled('staffing')
  await db.update(assignment_staff).set({ candidate_status: '確定', status: '確定' }).where(eq(assignment_staff.id, id))
  await advanceAssignmentStatus(assignmentId, '確定', ['受付', '予約', '打診中', '候補集約'])
  revalidatePath(`/assignments/${assignmentId}`)
}

export async function declineCandidate(id: string, assignmentId: string) {
  await requirePermission('assignments', 'update')
  await ensureModuleEnabled('staffing')
  await db.update(assignment_staff).set({ candidate_status: '辞退', status: 'キャンセル' }).where(eq(assignment_staff.id, id))
  revalidatePath(`/assignments/${assignmentId}`)
}

/** 確定/辞退を取り消して「候補」に戻す */
export async function reopenCandidate(id: string, assignmentId: string) {
  await requirePermission('assignments', 'update')
  await ensureModuleEnabled('staffing')
  await db.update(assignment_staff).set({ candidate_status: '候補', status: '予約' }).where(eq(assignment_staff.id, id))
  revalidatePath(`/assignments/${assignmentId}`)
}

export async function removeCandidate(id: string, assignmentId: string) {
  await requirePermission('assignments', 'delete')
  await ensureModuleEnabled('staffing')
  await db.delete(assignment_staff).where(eq(assignment_staff.id, id))
  revalidatePath(`/assignments/${assignmentId}`)
}
