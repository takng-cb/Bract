'use server'

import { recordHref } from '@/lib/relatedRecords'
import { trashRecord } from '@/lib/trash'

import { db } from '@/lib/db'
import { tasks, task_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'

/** related_records[] hidden inputs ("<api>:<id>") をパース */
function parseRelatedRecords(formData: FormData): { object_api: string; record_id: string }[] {
  const raw = formData.getAll('related_records') as string[]
  const out: { object_api: string; record_id: string }[] = []
  for (const r of raw) {
    const idx = r.indexOf(':')
    if (idx < 0) continue
    const api = r.slice(0, idx).trim()
    const id  = r.slice(idx + 1).trim()
    if (api && id) out.push({ object_api: api, record_id: id })
  }
  return out
}

/**
 * タスクの関連レコードを junction に同期する。
 * Phase 2 で FK 列への dual-write は撤廃済み。junction が唯一の関連先情報。
 */
async function syncTaskRelatedRecords(
  taskId: string,
  selections: { object_api: string; record_id: string }[],
) {
  await db.delete(task_related_records).where(eq(task_related_records.task_id, taskId))
  if (selections.length > 0) {
    const seen = new Set<string>()
    const rows = selections
      .filter((s) => {
        const k = `${s.object_api}::${s.record_id}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((s) => ({
        task_id:            taskId,
        related_object_api: s.object_api,
        related_record_id:  s.record_id,
      }))
    if (rows.length > 0) {
      await db.insert(task_related_records).values(rows).onConflictDoNothing()
    }
  }
}

export async function createTask(formData: FormData) {
  await requirePermission('tasks', 'create')
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('タイトルは必須です')

  const return_to  = (formData.get('return_to') as string) || null
  const selections = parseRelatedRecords(formData)

  const description = (formData.get('description') as string)?.trim() || null
  const owner_id    = (formData.get('owner_id') as string)?.trim() || null

  const [row] = await db.insert(tasks).values({
    title:       title.trim(),
    description,
    due_date:    (formData.get('due_date') as string) || null,
    priority:    (formData.get('priority') as string) || 'medium',
    owner_id,
  }).returning({ id: tasks.id })

  await syncTaskRelatedRecords(row.id, selections)

  if (return_to) redirect(return_to)
  const firstAccount = selections.find((s) => s.object_api === 'account')
  if (firstAccount) redirect(`/accounts/${firstAccount.record_id}`)
  const firstContact = selections.find((s) => s.object_api === 'contact')
  if (firstContact) redirect(`/contacts/${firstContact.record_id}`)
  const firstOpportunity = selections.find((s) => s.object_api === 'opportunity')
  if (firstOpportunity) redirect(`/opportunities/${firstOpportunity.record_id}`)
  const firstCustom = selections.find((s) => !['account', 'contact', 'opportunity'].includes(s.object_api))
  if (firstCustom) redirect(recordHref(firstCustom.object_api, firstCustom.record_id))
  redirect(`/tasks/${row.id}`)
}

/**
 * インラインコンポーザ用・その場で ToDo を作成（遷移せず revalidate のみ）。
 */
export async function quickCreateTask(formData: FormData) {
  await requirePermission('tasks', 'create')
  const title = (formData.get('title') as string)?.trim()
  if (!title) throw new Error('タイトルは必須です')
  const [row] = await db.insert(tasks).values({
    title,
    description: (formData.get('description') as string)?.trim() || null,
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'medium',
    owner_id: (formData.get('owner_id') as string)?.trim() || null,
  }).returning({ id: tasks.id })
  await syncTaskRelatedRecords(row.id, parseRelatedRecords(formData))
  const revalidate = formData.get('revalidate') as string
  if (revalidate) revalidatePath(revalidate)
}

/** 詳細情報カードのインライン編集用・部分更新（タイトル/関連レコードには触れない）。 */
export async function updateTaskBasic(id: string, formData: FormData) {
  await requirePermission('tasks', 'update')
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (formData.has('title') && (formData.get('title') as string)?.trim()) set.title = (formData.get('title') as string).trim()
  if (formData.has('due_date'))    set.due_date    = (formData.get('due_date') as string) || null
  if (formData.has('priority'))    set.priority    = (formData.get('priority') as string) || 'medium'
  if (formData.has('description')) set.description  = (formData.get('description') as string)?.trim() || null
  if (formData.has('owner_id'))    set.owner_id     = (formData.get('owner_id') as string)?.trim() || null
  await db.update(tasks).set(set).where(eq(tasks.id, id))
  redirect(`/tasks/${id}`)
}

export async function updateTask(id: string, formData: FormData) {
  await requirePermission('tasks', 'update')
  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('タイトルは必須です')

  const selections = parseRelatedRecords(formData)

  const description = (formData.get('description') as string)?.trim() || null
  const owner_id    = (formData.get('owner_id') as string)?.trim() || null

  await db.update(tasks).set({
    title:       title.trim(),
    description,
    due_date:    (formData.get('due_date') as string) || null,
    priority:    (formData.get('priority') as string) || 'medium',
    owner_id,
    updated_at:  new Date(),
  }).where(eq(tasks.id, id))

  await syncTaskRelatedRecords(id, selections)

  redirect(`/tasks/${id}`)
}

/** 関連レコードのインライン編集用・junction 同期のみ。 */
export async function updateTaskRelatedRecords(id: string, formData: FormData) {
  await requirePermission('tasks', 'update')
  await syncTaskRelatedRecords(id, parseRelatedRecords(formData))
  redirect(`/tasks/${id}`)
}

export async function deleteTask(id: string) {
  await requirePermission('tasks', 'delete')
  await trashRecord('tasks', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  await db.delete(tasks).where(eq(tasks.id, id))
  redirect('/tasks')
}

export async function toggleTaskDone(id: string, done: boolean, revalidate: string) {
  await requirePermission('tasks', 'update')
  await db.update(tasks)
    .set({ done, updated_at: new Date() })
    .where(eq(tasks.id, id))
  revalidatePath(revalidate)
  revalidatePath('/tasks')
}
