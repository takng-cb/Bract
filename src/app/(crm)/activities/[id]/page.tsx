import { db } from '@/lib/db'
import { activities, activity_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { deleteActivity, updateActivityBasic, updateActivityRelatedRecords } from '@/app/actions/activities'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import InlineRelatedRecordsEditor from '@/components/detail/InlineRelatedRecordsEditor'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import { getAllUsers } from '@/lib/userUtils'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import { getActivityTypes } from '@/lib/activityTypes'
import { resolveRelatedRecords } from '@/lib/relatedRecords'
import { Activity, CalendarClock, UserRound } from 'lucide-react'
import { RecordColumns, Badge } from '@/components/record/RecordUI'

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [activityRow, relatedPairs, allUsers] = await Promise.all([
    db.select({
      id: activities.id, type: activities.type, subject: activities.subject,
      body: activities.body, occurred_at: activities.occurred_at, created_at: activities.created_at,
      owner_id: activities.owner_id,
    }).from(activities).where(eq(activities.id, id)).then((r) => r[0] ?? null),
    db.select({ object_api: activity_related_records.related_object_api, record_id: activity_related_records.related_record_id })
      .from(activity_related_records).where(eq(activity_related_records.activity_id, id)),
    getAllUsers(),
  ])

  if (!activityRow) notFound()
  const ownerName = activityRow.owner_id ? (allUsers.find((u) => u.id === activityRow.owner_id)?.name ?? null) : null

  const [allRelated, pickerData] = await Promise.all([
    resolveRelatedRecords(relatedPairs),
    getRelatedRecordsPickerData('activities'),
  ])

  const activityTypes = await getActivityTypes()
  const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {}
  for (const t of activityTypes) TYPE_CONFIG[t.value] = { label: t.label, icon: t.icon }
  const typeConf = TYPE_CONFIG[activityRow.type] ?? { label: activityRow.type, icon: '📋' }

  const editFlag = await canEdit()

  async function handleDelete() { 'use server'; await deleteActivity(id) }
  async function saveActivityInline(formData: FormData) { 'use server'; await updateActivityBasic(id, formData) }
  async function saveActivityRelated(formData: FormData) { 'use server'; await updateActivityRelatedRecords(id, formData) }

  const occurredLabel = activityRow.occurred_at ? new Date(activityRow.occurred_at).toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '活動履歴', href: '/activities' }, { label: activityRow.subject }]}
        avatar={<Activity className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={activityRow.subject}
        badges={<Badge tone="info" dot>{typeConf.icon} {typeConf.label}</Badge>}
        meta={[
          { icon: <CalendarClock className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: occurredLabel },
          ...(ownerName ? [{ icon: <UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '担当', value: ownerName }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-activity" />
              <DeleteButton action={handleDelete} confirmMessage="この活動履歴を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <RecordColumns
        narrow
        left={
          <>
            <EditableInfoCard
              title="活動情報"
              dense
              canEdit={editFlag}
              showEditButton={false}
              editEvent="bract:edit-activity"
              action={saveActivityInline}
              fields={[
                { label: '件名', name: 'subject', kind: 'text', value: activityRow.subject, fullWidth: true, view: activityRow.subject ?? '—' },
                { label: '種別', name: 'type', kind: 'select', value: activityRow.type, options: activityTypes.map((t) => ({ value: t.value, label: t.label })), view: <span className="inline-flex items-center gap-1">{typeConf.icon} {typeConf.label}</span> },
                { label: '日時', name: 'occurred_at', kind: 'datetime', value: activityRow.occurred_at ? new Date(activityRow.occurred_at).toISOString().slice(0, 16) : '', view: occurredLabel },
                { label: '担当', name: 'owner_id', kind: 'select', value: activityRow.owner_id ?? '', options: allUsers.map((u) => ({ value: u.id, label: u.name })), view: ownerName ?? '—' },
                { label: '登録日', view: activityRow.created_at ? new Date(activityRow.created_at).toLocaleDateString('ja-JP') : '—' },
              ]}
            />

            <InlineRelatedRecordsEditor
              canEdit={editFlag}
              editEvent="bract:edit-activity"
              action={saveActivityRelated}
              objectTypes={pickerData.objectTypes}
              recordsByObject={pickerData.recordsByObject}
              defaultValue={relatedPairs.map((p) => ({ object_api: p.object_api, record_id: p.record_id }))}
              view={allRelated.length > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {allRelated.map((r, i) => (
                    <Link key={`${r.href}-${i}`} href={r.href} className="text-sm text-brand-700 hover:underline">{r.icon} {r.label}</Link>
                  ))}
                </div>
              ) : <p className="text-sm text-zinc-400">紐づくレコードなし</p>}
            />
          </>
        }
      >
        <EditableInfoCard
          title="内容・メモ"
          canEdit={editFlag}
          showEditButton={false}
          editEvent="bract:edit-activity"
          action={saveActivityInline}
          fields={[
            { label: '内容', name: 'body', kind: 'textarea', value: activityRow.body, fullWidth: true, view: activityRow.body ? <span className="text-sm leading-[1.85] text-zinc-800">{activityRow.body}</span> : <span className="text-zinc-300">内容が記録されていません</span> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
