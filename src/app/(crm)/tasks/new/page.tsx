import { db } from '@/lib/db'
import { accounts, contacts, opportunities, custom_records, object_definitions } from '@/lib/schema'
import { eq, asc, and } from 'drizzle-orm'
import TaskForm from '@/components/TaskForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createTask } from '@/app/actions/tasks'
import { requireEditor } from '@/lib/auth'
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

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string; custom_record_id?: string; return_to?: string }>
}) {
  const { account_id, contact_id, opportunity_id, custom_record_id, return_to } = await searchParams

  async function createTaskAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    if (return_to) formData.set('return_to', return_to)
    try { await createTask(formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }
  await requireEditor()

  const [accountsList, contactsList, opportunitiesList, enabledCustomObjects, allCustomRecords] = await Promise.all([
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
  ])

  const objectTypes: ObjectTypeOption[] = [
    { api: 'account',     label: '取引先', icon: '🏢' },
    { api: 'contact',     label: '人物',   icon: '👤' },
    { api: 'opportunity', label: '商談',   icon: '💼' },
    ...enabledCustomObjects.map((o) => ({ api: o.api_name, label: o.label, icon: o.icon })),
  ]

  const recordsByObject: Record<string, RecordOption[]> = {
    account:     accountsList.map((a) => ({ id: a.id, label: a.name })),
    contact:     contactsList.map((c) => ({ id: c.id, label: c.full_name })),
    opportunity: opportunitiesList.map((o) => ({ id: o.id, label: o.name })),
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

  // URL パラメータをデフォルト選択値に変換
  let customDefault: { api: string; record_id: string } | null = null
  if (custom_record_id) {
    const row = await db.select({
      object_id: custom_records.object_id,
      api_name:  object_definitions.api_name,
    })
      .from(custom_records)
      .innerJoin(object_definitions, eq(custom_records.object_id, object_definitions.id))
      .where(eq(custom_records.id, custom_record_id))
      .then((r) => r[0] ?? null)
    if (row) customDefault = { api: row.api_name, record_id: custom_record_id }
  }

  const defaultRelated: RelatedRecordSelection[] = []
  if (account_id)     defaultRelated.push({ object_api: 'account', record_id: account_id })
  if (contact_id)     defaultRelated.push({ object_api: 'contact', record_id: contact_id })
  if (opportunity_id) defaultRelated.push({ object_api: 'opportunity', record_id: opportunity_id })
  if (customDefault)  defaultRelated.push({ object_api: customDefault.api, record_id: customDefault.record_id })

  const cancelHref = return_to
    ?? (account_id     ? `/accounts/${account_id}`
    :   contact_id     ? `/contacts/${contact_id}`
    :   opportunity_id ? `/opportunities/${opportunity_id}`
    :                    '/tasks')

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: 'ToDo', href: '/tasks' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">ToDoを追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <TaskForm
          action={createTaskAction}
          cancelHref={cancelHref}
          objectTypes={objectTypes}
          recordsByObject={recordsByObject}
          defaultValues={{ related_records: defaultRelated }}
        />
      </div>
    </div>
  )
}
