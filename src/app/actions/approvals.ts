'use server'

/**
 * レコード承認 — Server Actions（REQ-0023 / ADR-0022 / #85）
 *
 * フロー（specs/approvals.md）:
 *   申請 → step1 → step2 … → 最終 step 承認で approved / いずれかの却下で rejected（差戻し）
 *   差戻し・却下後は再申請可（新しい approvals 行）。承認済みの取消は admin のみ。
 *   承認待ち中は対象レコードを編集ロック（各ブックの update/delete action 側で assertNotPendingApproval）。
 */
import { db } from '@/lib/db'
import { approvals, approval_decisions, system_settings, users } from '@/lib/schema'
import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId, requireAdmin } from '@/lib/auth'
import { getCurrentPermissions, requirePermission } from '@/lib/permissions'
import { logChanges } from '@/lib/changeLog'
import {
  hasPendingApproval,
  resolveRoute,
  routeFromSnapshot,
  APPROVAL_CONFIG_KEY_PREFIX,
} from '@/lib/approvals'
import {
  canDecideStep,
  isStepSatisfied,
  parseApprovalConfig,
  type ApprovalStep,
  type ApprovalRule,
  type ApprovalOp,
} from '@/lib/approvalRules'

const APPROVAL_OPS: ApprovalOp[] = ['=', '!=', '>', '>=', '<', '<=', 'contains']

/** 承認待ち中の編集ロック（各ブックの update/delete action 冒頭で呼ぶ） */
export async function assertNotPendingApproval(objectType: string, objectId: string): Promise<void> {
  if (await hasPendingApproval(objectType, objectId)) {
    throw new Error('このレコードは承認待ちのため編集できません（承認/差戻し後に編集可）')
  }
}

// ----------------------------------------------------------------
// 申請
// ----------------------------------------------------------------
export async function requestApproval(objectType: string, objectId: string, formData: FormData): Promise<void> {
  await requirePermission(objectType, 'read')
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')

  if (await hasPendingApproval(objectType, objectId)) {
    throw new Error('既に承認待ちの申請があります')
  }

  // 申請時点のルールでルートを確定し、スナップショットとして固定する
  const route = await resolveRoute(objectType, objectId)
  if (!route) throw new Error('このレコードは承認の対象ではありません（条件に合致しません）')

  const comment = ((formData.get('comment') as string) ?? '').trim() || null

  await db.insert(approvals).values({
    object_type:    objectType,
    object_id:      objectId,
    status:         'pending',
    requested_by:   userId,
    current_step:   1,
    route_snapshot: route,
    comment,
  })

  await logChanges(objectType, objectId,
    { approval: { label: '承認', value: null } },
    { approval: { label: '承認', value: `承認を申請（${route.length} 段階）` } })

  revalidatePath('/', 'layout')
}

// ----------------------------------------------------------------
// 承認 / 差戻し（現在 step の承認者のみ）
// ----------------------------------------------------------------
export async function decideApproval(approvalId: string, decision: 'approved' | 'rejected', formData: FormData): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  const perms = await getCurrentPermissions()

  const approval = await db.select().from(approvals)
    .where(eq(approvals.id, approvalId)).then((r) => r[0] ?? null)
  if (!approval) throw new Error('承認申請が見つかりません')
  if (approval.status !== 'pending') throw new Error('この申請は既に処理済みです')

  const route = routeFromSnapshot(approval.route_snapshot)
  const stepNo = approval.current_step
  const step = route[stepNo - 1]
  if (!step) throw new Error('承認ルートが不正です')

  const decisions = await db.select().from(approval_decisions)
    .where(eq(approval_decisions.approval_id, approvalId))

  if (!canDecideStep(step, stepNo, decisions, userId, perms.roleName)) {
    throw new Error('この段階の承認者ではないか、既に判定済みです')
  }

  const comment = ((formData.get('comment') as string) ?? '').trim() || null
  await db.insert(approval_decisions).values({
    approval_id: approvalId,
    step:        stepNo,
    approver_id: userId,
    decision,
    comment,
  })

  if (decision === 'rejected') {
    // 差戻し：申請全体を却下し編集ロック解除。再申請は新しい行で。
    await db.update(approvals)
      .set({ status: 'rejected', decided_at: new Date() })
      .where(eq(approvals.id, approvalId))
    await logChanges(approval.object_type, approval.object_id,
      { approval: { label: '承認', value: `承認待ち（${stepNo}/${route.length} 段階目）` } },
      { approval: { label: '承認', value: '差戻し' } })
  } else {
    // 承認：step 完了判定（mode all の role エントリ用に判定者のロール名を解決）
    const after = [...decisions, { approval_id: approvalId, step: stepNo, approver_id: userId, decision, comment, id: '', decided_at: new Date() }]
    const approverIds = [...new Set(after.map((d) => d.approver_id))]
    const roleRows = approverIds.length
      ? await db.select({ id: users.id, role: users.role }).from(users).where(inArray(users.id, approverIds))
      : []
    const rolesByUser = Object.fromEntries(roleRows.map((r) => [r.id, r.role]))
    // 判定者本人は権限解決済みの roleName を使う（users.role はフォールバック）
    rolesByUser[userId] = perms.roleName

    if (isStepSatisfied(step, stepNo, after, rolesByUser)) {
      if (stepNo >= route.length) {
        await db.update(approvals)
          .set({ status: 'approved', decided_at: new Date() })
          .where(eq(approvals.id, approvalId))
        await logChanges(approval.object_type, approval.object_id,
          { approval: { label: '承認', value: `承認待ち（${stepNo}/${route.length} 段階目）` } },
          { approval: { label: '承認', value: '承認済み' } })
      } else {
        await db.update(approvals)
          .set({ current_step: stepNo + 1 })
          .where(eq(approvals.id, approvalId))
      }
    }
  }

  revalidatePath('/', 'layout')
}

// ----------------------------------------------------------------
// 取消（pending は申請者本人 or admin。approved の取消は admin のみ）
// ----------------------------------------------------------------
export async function cancelApproval(approvalId: string): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  const perms = await getCurrentPermissions()

  const approval = await db.select().from(approvals)
    .where(eq(approvals.id, approvalId)).then((r) => r[0] ?? null)
  if (!approval) throw new Error('承認申請が見つかりません')

  if (approval.status === 'pending') {
    if (approval.requested_by !== userId && !perms.isAdmin) {
      throw new Error('承認待ちの取消は申請者本人または管理者のみ可能です')
    }
  } else if (approval.status === 'approved') {
    if (!perms.isAdmin) throw new Error('承認済みの取消は管理者のみ可能です')
  } else {
    throw new Error('この申請は取消できません')
  }

  const before = approval.status === 'approved' ? '承認済み' : '承認待ち'
  await db.update(approvals)
    .set({ status: 'cancelled', decided_at: new Date() })
    .where(eq(approvals.id, approvalId))
  await logChanges(approval.object_type, approval.object_id,
    { approval: { label: '承認', value: before } },
    { approval: { label: '承認', value: '取消' } })

  revalidatePath('/', 'layout')
}

// ----------------------------------------------------------------
// 承認設定の保存（管理者・ブック単位。Phase1 の最小ルールエディタ用）
//   formData:
//     enabled=on|off
//     cond_field / cond_op / cond_value（cond_value 空 = 無条件＝全件承認）
//     step_type_N / step_ref_N（N=1..、type=user|role）
// ----------------------------------------------------------------
export async function saveApprovalConfig(bookApi: string, formData: FormData): Promise<void> {
  await requireAdmin()

  const enabled = formData.get('enabled') === 'on'
  const condField = ((formData.get('cond_field') as string) ?? '').trim()
  const condOp    = ((formData.get('cond_op') as string) ?? '>=').trim()
  const condValue = ((formData.get('cond_value') as string) ?? '').trim()

  const steps: ApprovalStep[] = []
  for (let i = 1; i <= 10; i++) {
    const type = formData.get(`step_type_${i}`) as string | null
    const ref  = ((formData.get(`step_ref_${i}`) as string) ?? '').trim()
    if (!type || !ref) continue
    if (type !== 'user' && type !== 'role') continue
    steps.push({ approvers: [`${type}:${ref}`], mode: 'any' })
  }
  if (enabled && steps.length === 0) {
    throw new Error('承認を有効にするには承認ステップを1つ以上設定してください')
  }

  const op: ApprovalOp = APPROVAL_OPS.includes(condOp as ApprovalOp) ? (condOp as ApprovalOp) : '>='
  const rule: ApprovalRule = {
    ...(condField && condValue ? { when: { all: [{ field: condField, op, value: condValue }] } } : {}),
    steps,
  }
  const config = { enabled, rules: enabled ? [rule] : [] }
  // 保存形式の妥当性を自分で検証（parse が通らない形は保存しない）
  if (!parseApprovalConfig(JSON.stringify(config))) throw new Error('承認設定の形式が不正です')

  const key = `${APPROVAL_CONFIG_KEY_PREFIX}${bookApi}`
  await db.insert(system_settings)
    .values({ key, value: JSON.stringify(config) })
    .onConflictDoUpdate({
      target: system_settings.key,
      set:    { value: JSON.stringify(config), updated_at: new Date() },
    })

  revalidatePath('/admin/objects')
  revalidatePath('/', 'layout')
}
