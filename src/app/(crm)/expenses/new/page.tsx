import { db } from '@/lib/db'
import { accounts, contacts, opportunities, custom_records, object_definitions } from '@/lib/schema'
import { eq, asc, and } from 'drizzle-orm'
import ExpenseForm from '@/components/ExpenseForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createExpense } from '@/app/actions/expenses'
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

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; opportunity_id?: string; contact_id?: string; custom_record_id?: string; maintenance_id?: string; customer_vehicle_id?: string; return_to?: string }>
}) {
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

  const [accountsList, contactsList, opportunitiesList, enabledCustomObjects, allCustomRecords, industryPicker] = await Promise.all([
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
      .where(and(eq(object_definitions.is_builtin, false), eq(object_definitions.enable_expenses, true)))
      .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label)),
    db.select({
      id:        custom_records.id,
      object_id: custom_records.object_id,
      data:      custom_records.data,
    }).from(custom_records),
    getIndustryPickerData(),
  ])

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
          recordsByObject={recordsByObject}
          defaultValues={{ related_records: defaultRelated }}
        />
    </div>
  )
}
