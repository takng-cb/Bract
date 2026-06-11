import { db } from '@/lib/db'
import { book_records, book_definitions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import TaskForm from '@/components/TaskForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createTask } from '@/app/actions/tasks'
import { requireEditor, getCurrentUserId } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string; custom_record_id?: string; maintenance_id?: string; customer_vehicle_id?: string; return_to?: string }>
}) {
  await requireBookRead('tasks')  // RBAC: Read 権限ガード（ADR-0023）
  const { account_id, contact_id, opportunity_id, custom_record_id, maintenance_id, customer_vehicle_id, return_to } = await searchParams

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

  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [pickerData, users, currentUserId] = await Promise.all([
    getRelatedRecordsPickerData('tasks'),
    getAllUsers(),
    getCurrentUserId(),
  ])

  const objectTypes = pickerData.objectTypes

  // URL パラメータをデフォルト選択値に変換
  let customDefault: { api: string; record_id: string } | null = null
  if (custom_record_id) {
    const row = await db.select({
      object_id: book_records.object_id,
      api_name:  book_definitions.api_name,
    })
      .from(book_records)
      .innerJoin(book_definitions, eq(book_records.object_id, book_definitions.id))
      .where(eq(book_records.id, custom_record_id))
      .then((r) => r[0] ?? null)
    if (row) customDefault = { api: row.api_name, record_id: custom_record_id }
  }

  const defaultRelated: RelatedRecordSelection[] = []
  if (account_id)          defaultRelated.push({ object_api: 'account',          record_id: account_id })
  if (contact_id)          defaultRelated.push({ object_api: 'contact',          record_id: contact_id })
  if (opportunity_id)      defaultRelated.push({ object_api: 'opportunity',      record_id: opportunity_id })
  if (maintenance_id)      defaultRelated.push({ object_api: 'maintenance',      record_id: maintenance_id })
  if (customer_vehicle_id) defaultRelated.push({ object_api: 'customer-vehicle', record_id: customer_vehicle_id })
  if (customDefault)       defaultRelated.push({ object_api: customDefault.api,  record_id: customDefault.record_id })

  const cancelHref = return_to
    ?? (account_id          ? `/accounts/${account_id}`
    :   contact_id          ? `/contacts/${contact_id}`
    :   opportunity_id      ? `/opportunities/${opportunity_id}`
    :   maintenance_id      ? `/maintenance/${maintenance_id}`
    :   customer_vehicle_id ? `/customer-vehicles/${customer_vehicle_id}`
    :                         '/tasks')

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: 'ToDo', href: '/tasks' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">ToDoを追加</h1>
        <TaskForm
          action={createTaskAction}
          cancelHref={cancelHref}
          objectTypes={objectTypes}
          users={users}
          defaultValues={{
            related_records: defaultRelated,
            owner_id:        currentUserId ?? null,  // 新規作成時は自分を初期セット
          }}
        />
    </div>
  )
}
