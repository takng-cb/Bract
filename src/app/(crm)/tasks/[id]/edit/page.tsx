import { db } from '@/lib/db'
import { tasks, accounts, contacts, opportunities, custom_records, object_definitions, task_related_records } from '@/lib/schema'
import { eq, asc, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import TaskForm from '@/components/TaskForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateTask } from '@/app/actions/tasks'
import { requireEditor } from '@/lib/auth'
import { getIndustryPickerData } from '@/lib/relatedRecordsPicker'
import type { ObjectTypeOption, RecordOption, RelatedRecordSelection } from '@/components/RelatedRecordsPicker'

function customRecordTitle(
  data: Record<string, unknown> | null | undefined,
  objectLabel: string | null | undefined,
  recordId: string,
): string {
  const d = (data ?? {}) as Record<string, unknown>
  const name = typeof d.name === 'string' ? d.name : null
  const title = typeof d.title === 'string' ? d.title : null
  return name ?? title ?? `${objectLabel ?? 'カスタム'} #${recordId.slice(0, 8)}`
}

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [task, accountsList, contactsList, opportunitiesList, enabledCustomObjects, allCustomRecords, relatedRows, industryPicker] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
    db.select({
      id:       object_definitions.id,
      api_name: object_definitions.api_name,
      label:    object_definitions.label,
      icon:     object_definitions.icon,
    })
      .from(object_definitions)
      .where(and(eq(object_definitions.is_builtin, false), eq(object_definitions.enable_tasks, true)))
      .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label)),
    db.select({
      id:        custom_records.id,
      object_id: custom_records.object_id,
      data:      custom_records.data,
    }).from(custom_records),
    db.select({
      object_api: task_related_records.related_object_api,
      record_id:  task_related_records.related_record_id,
    })
      .from(task_related_records)
      .where(eq(task_related_records.task_id, id)),
    getIndustryPickerData(),
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

  const objectTypes: ObjectTypeOption[] = [
    { api: 'account',     label: '取引先', icon: '🏢' },
    { api: 'contact',     label: '人物',   icon: '👤' },
    { api: 'opportunity', label: '商談',   icon: '💼' },
    ...industryPicker.industryObjectTypes,
    ...enabledCustomObjects.map((o) => ({ api: o.api_name, label: o.label, icon: o.icon })),
  ]

  const recordsByObject: Record<string, RecordOption[]> = {
    account:     accountsList.map((a) => ({ id: a.id, label: a.name })),
    contact:     contactsList.map((c) => ({ id: c.id, label: c.full_name })),
    opportunity: opportunitiesList.map((o) => ({ id: o.id, label: o.name })),
    ...industryPicker.industryRecordsByObject,
  }
  const objectIdToApiName = new Map(enabledCustomObjects.map((o) => [o.id, o.api_name]))
  const objectIdToLabel   = new Map(enabledCustomObjects.map((o) => [o.id, o.label]))
  for (const r of allCustomRecords) {
    const api = objectIdToApiName.get(r.object_id)
    if (!api) continue
    if (!recordsByObject[api]) recordsByObject[api] = []
    recordsByObject[api].push({
      id:    r.id,
      label: customRecordTitle(r.data as Record<string, unknown>, objectIdToLabel.get(r.object_id), r.id),
    })
  }

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
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <TaskForm
          action={updateTaskAction}
          cancelHref={`/tasks/${id}`}
          objectTypes={objectTypes}
          recordsByObject={recordsByObject}
          defaultValues={{
            title:    task.title,
            due_date: task.due_date,
            priority: task.priority,
            related_records: defaultRelated,
          }}
        />
      </div>
    </div>
  )
}
