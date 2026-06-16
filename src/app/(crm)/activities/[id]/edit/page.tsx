import { db } from '@/lib/db'
import { activities, activity_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import ActivityForm from '@/components/ActivityForm'
import RecordHeader from '@/components/RecordHeader'
import { updateActivity } from '@/app/actions/activities'
import { requireEditor } from '@/lib/auth'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAllUsers } from '@/lib/userUtils'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'
import { hasFeature } from '@/lib/license'

const FORM_ID = 'record-create-form'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('activities')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  await requireEditor()
  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [activity, pickerData, relatedRows, activityTypes, users, plaudEnabled] = await Promise.all([
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
    hasFeature('plaud_import'),
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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051） */}
      <RecordHeader
        crumbs={[
          { label: '活動履歴', href: '/activities' },
          { label: activity.subject, href: `/activities/${id}` },
          { label: '編集' },
        ]}
        avatar={<Activity className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={activity.subject}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/activities/${id}`} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
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

      <ActivityForm
        action={updateActivityAction}
        cancelHref={`/activities/${id}`}
        objectTypes={objectTypes}
        activityTypes={activityTypes}
        users={users}
        formId={FORM_ID}
        plaudEnabled={plaudEnabled}
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
