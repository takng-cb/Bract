'use server'

/**
 * projects（プロジェクト管理モジュール）CRUD（REQ-0080）。
 * 業種非依存の ERP モジュール。UI は商談を参考にした専用リッチ画面。
 * インライン編集・編集フォームともに updateProject（全項目）を使う（フォームは全送信前提）。
 */
import { requirePermission, requireRecordScope, recordScope, type CrudOp } from '@/lib/permissions'
import { trashRecord } from '@/lib/trash'
import { cleanupRecordLinksForParent } from '@/lib/recordLinks'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { withSaveToast } from '@/lib/saveToast'
import { logChanges } from '@/lib/changeLog'

/** レコードスコープ（REQ-0083）。'own' のロールは自分担当でないプロジェクトを更新/削除できない。 */
async function guardProjectScope(id: string, op: CrudOp) {
  if ((await recordScope('projects', op)) !== 'own') return
  const [row] = await db.select({ owner_id: projects.owner_id }).from(projects).where(eq(projects.id, id))
  await requireRecordScope('projects', op, row?.owner_id ?? null)
}

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function num(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : null
}

function valuesFrom(formData: FormData) {
  return {
    name:             s(formData, 'name'),
    status:           s(formData, 'status') ?? '企画',
    project_type:     s(formData, 'project_type'),
    account_id:       s(formData, 'account_id'),
    contact_id:       s(formData, 'contact_id'),
    location:         s(formData, 'location'),
    start_date:       s(formData, 'start_date'),
    end_date:         s(formData, 'end_date'),
    budget:           num(formData, 'budget'),
    expected_revenue: num(formData, 'expected_revenue'),
    actual_cost:      num(formData, 'actual_cost') ?? '0',
    description:      s(formData, 'description'),
    owner_id:         s(formData, 'owner_id'),
  }
}

export async function createProject(formData: FormData): Promise<string> {
  await requirePermission('projects', 'create')
  const v = valuesFrom(formData)
  if (!v.name) throw new Error('プロジェクト名は必須です')
  const [row] = await db.insert(projects).values({ ...v, name: v.name }).returning({ id: projects.id })
  return row.id
}

export async function updateProject(id: string, formData: FormData) {
  await requirePermission('projects', 'update')
  await guardProjectScope(id, 'update')
  const v = valuesFrom(formData)
  if (!v.name) throw new Error('プロジェクト名は必須です')
  const name = v.name

  const [before] = await db.select({
    name: projects.name, status: projects.status, budget: projects.budget,
    expected_revenue: projects.expected_revenue, actual_cost: projects.actual_cost,
  }).from(projects).where(eq(projects.id, id))

  await db.update(projects).set({ ...v, name, updated_at: new Date() }).where(eq(projects.id, id))

  if (before) {
    await logChanges('project', id,
      { name: { label: 'プロジェクト名', value: before.name }, status: { label: 'ステータス', value: before.status }, budget: { label: '予算', value: before.budget }, expected_revenue: { label: '想定売上', value: before.expected_revenue }, actual_cost: { label: '実績原価', value: before.actual_cost } },
      { name: { label: 'プロジェクト名', value: v.name }, status: { label: 'ステータス', value: v.status }, budget: { label: '予算', value: v.budget }, expected_revenue: { label: '想定売上', value: v.expected_revenue }, actual_cost: { label: '実績原価', value: v.actual_cost } },
    )
  }
  redirect(withSaveToast(`/projects/${id}`, 'saved'))
}

/** StageBar からのステータス変更（直接更新） */
export async function updateProjectStatus(id: string, status: string): Promise<void> {
  await requirePermission('projects', 'update')
  await guardProjectScope(id, 'update')
  const [before] = await db.select({ status: projects.status }).from(projects).where(eq(projects.id, id))
  await db.update(projects).set({ status, updated_at: new Date() }).where(eq(projects.id, id))
  if (before) {
    await logChanges('project', id,
      { status: { label: 'ステータス', value: before.status } },
      { status: { label: 'ステータス', value: status } },
    )
  }
  revalidatePath(`/projects/${id}`)
}

export async function deleteProject(id: string) {
  await requirePermission('projects', 'delete')
  await guardProjectScope(id, 'delete')
  await trashRecord('projects', id)        // ゴミ箱へ退避（REQ-0047）
  await cleanupRecordLinksForParent('project', id)
  await db.delete(projects).where(eq(projects.id, id))
  redirect(withSaveToast('/projects', 'deleted'))
}
