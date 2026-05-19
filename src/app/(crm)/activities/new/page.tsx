import { db } from '@/lib/db'
import { accounts, contacts, opportunities, custom_records, object_definitions } from '@/lib/schema'
import { eq, asc, and } from 'drizzle-orm'
import ActivityForm from '@/components/ActivityForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createActivity } from '@/app/actions/activities'
import { requireEditor, getCurrentUserId } from '@/lib/auth'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import { getIndustryPickerData } from '@/lib/relatedRecordsPicker'
import type { ObjectTypeOption, RecordOption, RelatedRecordSelection } from '@/components/RelatedRecordsPicker'

/**
 * カスタムレコードの表示名を導出する。
 * data.name → data.title → "<オブジェクトラベル> #<short id>" の優先順。
 */
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

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string; custom_record_id?: string; maintenance_id?: string; customer_vehicle_id?: string; return_to?: string }>
}) {
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

  // 標準 + 有効カスタムオブジェクト + 業種固有オブジェクトを並列取得
  const [accountsList, contactsList, opportunitiesList, enabledCustomObjects, allCustomRecords, activityTypes, industryPicker, users, currentUserId] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
    db.select({
      id:           object_definitions.id,
      api_name:     object_definitions.api_name,
      label:        object_definitions.label,
      icon:         object_definitions.icon,
    })
      .from(object_definitions)
      .where(and(eq(object_definitions.is_builtin, false), eq(object_definitions.enable_activities, true)))
      .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label)),
    db.select({
      id:        custom_records.id,
      object_id: custom_records.object_id,
      data:      custom_records.data,
    }).from(custom_records),
    getActivityTypes(),
    getIndustryPickerData(),
    getAllUsers(),
    getCurrentUserId(),
  ])

  // 関連レコード Picker の入力データを組み立て
  const objectTypes: ObjectTypeOption[] = [
    { api: 'account',     label: '取引先', icon: '🏢' },
    { api: 'contact',     label: '人物',   icon: '👤' },
    { api: 'opportunity', label: '商談',   icon: '💼' },
    ...industryPicker.industryObjectTypes,
    ...enabledCustomObjects.map((o) => ({ api: o.api_name, label: o.label, icon: o.icon })),
  ]

  // 標準オブジェクトのレコード + 業種固有レコード
  const recordsByObject: Record<string, RecordOption[]> = {
    account:     accountsList.map((a) => ({ id: a.id, label: a.name })),
    contact:     contactsList.map((c) => ({ id: c.id, label: c.full_name })),
    opportunity: opportunitiesList.map((o) => ({ id: o.id, label: o.name })),
    ...industryPicker.industryRecordsByObject,
  }

  // カスタムオブジェクトのレコードを api_name でグルーピング
  const objectIdToApiName = new Map(enabledCustomObjects.map((o) => [o.id, o.api_name]))
  const objectIdToLabel   = new Map(enabledCustomObjects.map((o) => [o.id, o.label]))
  for (const r of allCustomRecords) {
    const api = objectIdToApiName.get(r.object_id)
    if (!api) continue  // enable_activities=false のオブジェクトは除外
    if (!recordsByObject[api]) recordsByObject[api] = []
    recordsByObject[api].push({
      id:    r.id,
      label: customRecordTitle(r.data as Record<string, unknown>, objectIdToLabel.get(r.object_id), r.id),
    })
  }

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
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ActivityForm
          action={createActivityAction}
          cancelHref={cancelHref}
          objectTypes={objectTypes}
          recordsByObject={recordsByObject}
          activityTypes={activityTypes}
          users={users}
          defaultValues={{
            related_records: defaultRelated,
            owner_id:        currentUserId ?? null,
          }}
        />
      </div>
    </div>
  )
}
