import { db } from '@/lib/db'
import { activities, activity_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ActivityForm from '@/components/ActivityForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateActivity } from '@/app/actions/activities'
import { requireEditor } from '@/lib/auth'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('activities')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  await requireEditor()
  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [activity, pickerData, relatedRows, activityTypes, users] = await Promise.all([
    db.select().from(activities).where(eq(activities.id, id)).then((r) => r[0] ?? null),
    getRelatedRecordsPickerData('activities'),
    db.select({
      object_api: activity_related_records.related_object_api,
      record_id:  activity_related_records.related_record_id,
    })
      .from(activity_related_records)
      .where(eq(activity_related_records.activity_id, id)),
    getActivityTypes(),
    getAllUsers(),
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
  const objectTypes = pickerData.objectTypes

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
        <ActivityForm
          action={updateActivityAction}
          cancelHref={`/activities/${id}`}
          objectTypes={objectTypes}
          activityTypes={activityTypes}
          users={users}
          defaultValues={{
            type: activity.type,
            subject: activity.subject,
            body: activity.body,
            occurred_at: activity.occurred_at
              ? new Date(activity.occurred_at).toISOString().slice(0, 16)
              : '',
            owner_id:        activity.owner_id,
            related_records: defaultRelated,
          }}
        />
    </div>
  )
}
