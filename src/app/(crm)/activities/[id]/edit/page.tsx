import { db } from '@/lib/db'
import {
  activities,
  accounts,
  contacts,
  opportunities,
  custom_records,
  object_definitions,
  activity_related_records,
} from '@/lib/schema'
import { eq, asc, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ActivityForm from '@/components/ActivityForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateActivity } from '@/app/actions/activities'
import { requireEditor } from '@/lib/auth'
import { getActivityTypes } from '@/lib/activityTypes'
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

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [activity, accountsList, contactsList, opportunitiesList, enabledCustomObjects, allCustomRecords, relatedRows, activityTypes, industryPicker] = await Promise.all([
    db.select().from(activities).where(eq(activities.id, id)).then((r) => r[0] ?? null),
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
      .where(and(eq(object_definitions.is_builtin, false), eq(object_definitions.enable_activities, true)))
      .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label)),
    db.select({
      id:        custom_records.id,
      object_id: custom_records.object_id,
      data:      custom_records.data,
    }).from(custom_records),
    db.select({
      object_api: activity_related_records.related_object_api,
      record_id:  activity_related_records.related_record_id,
    })
      .from(activity_related_records)
      .where(eq(activity_related_records.activity_id, id)),
    getActivityTypes(),
    getIndustryPickerData(),
  ])

  if (!activity) notFound()

  async function updateActivityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateActivity(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  // 関連レコード Picker の入力データを組み立て
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
        { label: '活動履歴', href: '/activities' },
        { label: activity.subject, href: `/activities/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">活動を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ActivityForm
          action={updateActivityAction}
          cancelHref={`/activities/${id}`}
          objectTypes={objectTypes}
          recordsByObject={recordsByObject}
          activityTypes={activityTypes}
          defaultValues={{
            type: activity.type,
            subject: activity.subject,
            body: activity.body,
            occurred_at: activity.occurred_at
              ? new Date(activity.occurred_at).toISOString().slice(0, 16)
              : '',
            related_records: defaultRelated,
          }}
        />
      </div>
    </div>
  )
}
