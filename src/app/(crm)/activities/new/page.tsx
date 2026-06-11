import { db } from '@/lib/db'
import { contacts, opportunities, book_records, book_definitions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import ActivityForm from '@/components/ActivityForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createActivity } from '@/app/actions/activities'
import { requireEditor, getCurrentUserId } from '@/lib/auth'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string; custom_record_id?: string; maintenance_id?: string; customer_vehicle_id?: string; return_to?: string }>
}) {
  await requireBookRead('activities')  // RBAC: Read 権限ガード（ADR-0023）
  const { account_id, contact_id, opportunity_id, custom_record_id, maintenance_id, customer_vehicle_id, return_to } = await searchParams

  async function createActivityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    if (return_to) formData.set('return_to', return_to)
    try { await createActivity(formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }
  await requireEditor()

  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [pickerData, activityTypes, users, currentUserId] = await Promise.all([
    getRelatedRecordsPickerData('activities'),
    getActivityTypes(),
    getAllUsers(),
    getCurrentUserId(),
  ])
  const objectTypes = pickerData.objectTypes

  // URL パラメータをデフォルト選択値に変換
  // contact_id / opportunity_id から account_id を補完する旧挙動を維持
  let resolvedAccountId = account_id ?? ''
  if (!resolvedAccountId && contact_id) {
    const row = await db.select({ account_id: contacts.account_id })
      .from(contacts).where(eq(contacts.id, contact_id)).then((r) => r[0] ?? null)
    resolvedAccountId = row?.account_id ?? ''
  }
  if (!resolvedAccountId && opportunity_id) {
    const row = await db.select({ account_id: opportunities.account_id })
      .from(opportunities).where(eq(opportunities.id, opportunity_id)).then((r) => r[0] ?? null)
    resolvedAccountId = row?.account_id ?? ''
  }

  // custom_record_id が渡されたら api_name を解決
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
  if (resolvedAccountId)    defaultRelated.push({ object_api: 'account',          record_id: resolvedAccountId })
  if (contact_id)           defaultRelated.push({ object_api: 'contact',          record_id: contact_id })
  if (opportunity_id)       defaultRelated.push({ object_api: 'opportunity',      record_id: opportunity_id })
  if (maintenance_id)       defaultRelated.push({ object_api: 'maintenance',      record_id: maintenance_id })
  if (customer_vehicle_id)  defaultRelated.push({ object_api: 'customer-vehicle', record_id: customer_vehicle_id })
  if (customDefault)        defaultRelated.push({ object_api: customDefault.api,  record_id: customDefault.record_id })

  const cancelHref = return_to
    ?? (account_id          ? `/accounts/${account_id}`
    :   contact_id          ? `/contacts/${contact_id}`
    :   opportunity_id      ? `/opportunities/${opportunity_id}`
    :   maintenance_id      ? `/maintenance/${maintenance_id}`
    :   customer_vehicle_id ? `/customer-vehicles/${customer_vehicle_id}`
    :                         '/activities')

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '活動履歴', href: '/activities' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">活動を記録</h1>
        <ActivityForm
          action={createActivityAction}
          cancelHref={cancelHref}
          objectTypes={objectTypes}
          activityTypes={activityTypes}
          users={users}
          defaultValues={{
            related_records: defaultRelated,
            owner_id:        currentUserId ?? null,
          }}
        />
    </div>
  )
}
