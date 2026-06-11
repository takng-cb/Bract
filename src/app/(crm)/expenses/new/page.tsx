import { db } from '@/lib/db'
import { custom_records, object_definitions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import ExpenseForm from '@/components/ExpenseForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createExpense } from '@/app/actions/expenses'
import { requireEditor } from '@/lib/auth'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; opportunity_id?: string; contact_id?: string; custom_record_id?: string; maintenance_id?: string; customer_vehicle_id?: string; return_to?: string }>
}) {
  await requireBookRead('expenses')  // RBAC: Read 権限ガード（ADR-0023）
  const { account_id, opportunity_id, contact_id, custom_record_id, maintenance_id, customer_vehicle_id, return_to } = await searchParams

  async function createExpenseAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    if (return_to) formData.set('return_to', return_to)
    try { await createExpense(formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }
  await requireEditor()

  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [pickerData] = await Promise.all([
    getRelatedRecordsPickerData('expenses'),
  ])

  const objectTypes = pickerData.objectTypes

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
  if (account_id)          defaultRelated.push({ object_api: 'account',          record_id: account_id })
  if (contact_id)          defaultRelated.push({ object_api: 'contact',          record_id: contact_id })
  if (opportunity_id)      defaultRelated.push({ object_api: 'opportunity',      record_id: opportunity_id })
  if (maintenance_id)      defaultRelated.push({ object_api: 'maintenance',      record_id: maintenance_id })
  if (customer_vehicle_id) defaultRelated.push({ object_api: 'customer-vehicle', record_id: customer_vehicle_id })
  if (customDefault)       defaultRelated.push({ object_api: customDefault.api,  record_id: customDefault.record_id })

  const cancelHref = return_to
    ?? (opportunity_id      ? `/opportunities/${opportunity_id}`
    :   account_id          ? `/accounts/${account_id}`
    :   maintenance_id      ? `/maintenance/${maintenance_id}`
    :   customer_vehicle_id ? `/customer-vehicles/${customer_vehicle_id}`
    :                         '/expenses')

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '経費管理', href: '/expenses' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">経費を追加</h1>
        <ExpenseForm
          action={createExpenseAction}
          cancelHref={cancelHref}
          objectTypes={objectTypes}
          defaultValues={{ related_records: defaultRelated }}
        />
    </div>
  )
}
