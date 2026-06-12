import { db } from '@/lib/db'
import { tasks, task_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SquareCheckBig } from 'lucide-react'
import TaskForm from '@/components/TaskForm'
import RecordHeader from '@/components/RecordHeader'
import { updateTask } from '@/app/actions/tasks'
import { requireEditor } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051） */}
      <RecordHeader
        crumbs={[
          { label: 'ToDo', href: '/tasks' },
          { label: task.title, href: `/tasks/${id}` },
          { label: '編集' },
        ]}
        avatar={<SquareCheckBig className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={task.title}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/tasks/${id}`} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form={FORM_ID}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        }
      />

      <TaskForm
        action={updateTaskAction}
        cancelHref={`/tasks/${id}`}
        objectTypes={objectTypes}
        users={users}
        formId={FORM_ID}
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
