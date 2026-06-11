import { db } from '@/lib/db'
import { tasks, task_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import TaskForm from '@/components/TaskForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateTask } from '@/app/actions/tasks'
import { requireEditor } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('tasks')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  await requireEditor()
  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [task, pickerData, relatedRows, users] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.id, id)).then((r) => r[0] ?? null),
    getRelatedRecordsPickerData('tasks'),
    db.select({
      object_api: task_related_records.related_object_api,
      record_id:  task_related_records.related_record_id,
    })
      .from(task_related_records)
      .where(eq(task_related_records.task_id, id)),
    getAllUsers(),
  ])

  if (!task) notFound()

  async function updateTaskAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateTask(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  const objectTypes = pickerData.objectTypes

  const defaultRelated: RelatedRecordSelection[] = relatedRows.map((r) => ({
    object_api: r.object_api,
    record_id:  r.record_id,
  }))

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: 'ToDo', href: '/tasks' },
        { label: task.title, href: `/tasks/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">ToDoを編集</h1>
        <TaskForm
          action={updateTaskAction}
          cancelHref={`/tasks/${id}`}
          objectTypes={objectTypes}
          users={users}
          defaultValues={{
            title:       task.title,
            description: task.description,
            due_date:    task.due_date,
            priority:    task.priority,
            owner_id:    task.owner_id,
            related_records: defaultRelated,
          }}
        />
    </div>
  )
}
