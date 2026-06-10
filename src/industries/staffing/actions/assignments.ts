'use server'

/**
 * assignments (案件) CRUD アクション (Issue #69)
 */
import { db } from '@/lib/db'
import { assignments, assignment_staff, accounts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { generateAssignmentNo } from '@/industries/staffing/lib/assignmentNo'
import { buildAssignmentTitle } from '@/industries/staffing/lib/assignmentTitle'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

function pickInt(formData: FormData, key: string): number | null {
  const v = pick(formData, key)
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function createAssignment(formData: FormData): Promise<string> {
  await requireEditor()

  const client_account_id = pick(formData, 'client_account_id')
  if (!client_account_id) throw new Error('派遣先（取引先）は必須です')

  // 表示名タイトルを「取引先名＋日付＋内容」で生成（REQ-0017/0018・重複検出と同じ規則）
  const [clientAcc] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, client_account_id)).limit(1)
  const title = buildAssignmentTitle(clientAcc?.name ?? '', {
    work_date: pick(formData, 'service_date'),
    content: pick(formData, 'service_description') ?? pick(formData, 'service_type') ?? pick(formData, 'service_location'),
  })

  // UNIQUE 違反したら 5 回まで番号再採番
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await generateAssignmentNo()
    try {
      const [row] = await db.insert(assignments).values({
        assignment_no:        no,
        title,
        client_account_id,
        client_contact_id:    pick(formData, 'client_contact_id'),
        service_date:         pick(formData, 'service_date'),
        service_start_time:   pick(formData, 'service_start_time'),
        service_end_time:     pick(formData, 'service_end_time'),
        service_location:     pick(formData, 'service_location'),
        service_type:         pick(formData, 'service_type'),
        service_description:  pick(formData, 'service_description'),
        staff_count_required: pickInt(formData, 'staff_count_required'),
        status:               pick(formData, 'status') ?? '予約',
        client_total_fee:     pick(formData, 'client_total_fee'),
        internal_memo:        pick(formData, 'internal_memo'),
        owner_id:             pick(formData, 'owner_id'),
      }).returning({ id: assignments.id })
      revalidatePath('/assignments')
      return row.id
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!/assignment_no|unique|duplicate/i.test(msg)) throw e
    }
  }
  throw new Error('案件番号の採番に失敗しました（同時実行衝突）。再度お試しください。' + (lastErr ? ` (${(lastErr as Error).message})` : ''))
}

/** 案件ステータスを直接変更（詳細画面の進行操作用） */
export async function setAssignmentStatus(id: string, status: string) {
  await requireEditor()
  await db.update(assignments).set({ status, updated_at: new Date() }).where(eq(assignments.id, id))
  revalidatePath(`/assignments/${id}`)
  revalidatePath('/assignments')
}

/**
 * インライン編集用・部分更新。送信されたフィールドだけ更新（formData.has 判定）。
 * 派遣先(client_account_id) は必須のため空送信時は更新しない。
 */
export async function updateAssignmentBasic(id: string, formData: FormData) {
  await requireEditor()
  const set: Record<string, unknown> = { updated_at: new Date() }
  for (const k of ['client_contact_id', 'owner_id', 'service_date', 'service_start_time', 'service_end_time', 'service_type', 'service_location', 'client_total_fee', 'service_description', 'internal_memo'] as const) {
    if (formData.has(k)) set[k] = pick(formData, k)
  }
  if (formData.has('staff_count_required')) set.staff_count_required = pickInt(formData, 'staff_count_required')
  if (formData.has('client_account_id') && pick(formData, 'client_account_id')) set.client_account_id = pick(formData, 'client_account_id')
  await db.update(assignments).set(set).where(eq(assignments.id, id))
  redirect(`/assignments/${id}`)
}

export async function updateAssignment(id: string, formData: FormData) {
  await requireEditor()
  const client_account_id = pick(formData, 'client_account_id')
  if (!client_account_id) throw new Error('派遣先は必須です')

  await db.update(assignments).set({
    client_account_id,
    client_contact_id:    pick(formData, 'client_contact_id'),
    service_date:         pick(formData, 'service_date'),
    service_start_time:   pick(formData, 'service_start_time'),
    service_end_time:     pick(formData, 'service_end_time'),
    service_location:     pick(formData, 'service_location'),
    service_type:         pick(formData, 'service_type'),
    service_description:  pick(formData, 'service_description'),
    staff_count_required: pickInt(formData, 'staff_count_required'),
    status:               pick(formData, 'status') ?? '予約',
    client_total_fee:     pick(formData, 'client_total_fee'),
    internal_memo:        pick(formData, 'internal_memo'),
    owner_id:             pick(formData, 'owner_id'),
    updated_at:           new Date(),
  }).where(eq(assignments.id, id))

  redirect(`/assignments/${id}`)
}

export async function deleteAssignment(id: string) {
  await requireEditor()
  await db.delete(assignments).where(eq(assignments.id, id))
  revalidatePath('/assignments')
  redirect('/assignments')
}

// 案件にスタッフを追加・更新・削除

export async function assignStaffToAssignment(
  assignmentId: string,
  data: {
    staff_id:        string
    service_hours?:  number | null
    hourly_rate?:    number | null
    cost_per_hour?:  number | null
    status?:         string
    notes?:          string | null
  },
) {
  await requireEditor()
  if (!data.staff_id) throw new Error('スタッフは必須です')

  await db.insert(assignment_staff).values({
    assignment_id:  assignmentId,
    staff_id:       data.staff_id,
    service_hours:  data.service_hours != null ? String(data.service_hours) : null,
    hourly_rate:    data.hourly_rate != null   ? String(data.hourly_rate)   : null,
    cost_per_hour:  data.cost_per_hour != null ? String(data.cost_per_hour) : null,
    status:         data.status ?? '予約',
    notes:          data.notes ?? null,
  })

  revalidatePath(`/assignments/${assignmentId}`)
}

export async function unassignStaff(assignmentStaffId: string, assignmentId: string) {
  await requireEditor()
  await db.delete(assignment_staff).where(eq(assignment_staff.id, assignmentStaffId))
  revalidatePath(`/assignments/${assignmentId}`)
}
