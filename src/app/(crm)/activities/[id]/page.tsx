import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import { activities, activity_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteActivity } from '@/app/actions/activities'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import { getAllUsers } from '@/lib/userUtils'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import { getActivityTypes } from '@/lib/activityTypes'
import { resolveRelatedRecords } from '@/lib/relatedRecords'
import { NavIcon } from '@/lib/navIcon'

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [activityRow, relatedPairs, allUsers] = await Promise.all([
    db.select({
      id: activities.id, type: activities.type, subject: activities.subject,
      body: activities.body, occurred_at: activities.occurred_at, created_at: activities.created_at,
      owner_id: activities.owner_id,
    })
      .from(activities)
      .where(eq(activities.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      object_api: activity_related_records.related_object_api,
      record_id:  activity_related_records.related_record_id,
    })
      .from(activity_related_records)
      .where(eq(activity_related_records.activity_id, id)),
    getAllUsers(),
  ])

  if (!activityRow) notFound()
  const ownerName = activityRow.owner_id ? (allUsers.find((u) => u.id === activityRow.owner_id)?.name ?? null) : null

  // junction 経由で全関連レコードを解決
  const allRelated = await resolveRelatedRecords(relatedPairs)
  const linkedContacts = allRelated.filter((r) => r.object_api === 'contact')

  const activityTypes = await getActivityTypes()
  const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {}
  for (const t of activityTypes) {
    TYPE_CONFIG[t.value] = {
      label: t.label,
      icon: t.icon,
      color: t.color ?? 'bg-zinc-50 text-zinc-700 border-zinc-200',
    }
  }

  const typeConf = TYPE_CONFIG[activityRow.type] ?? { label: activityRow.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600 border-zinc-200' }

  async function handleDelete() {
    'use server'
    await deleteActivity(id)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <RecordHeader
        crumbs={[
          { label: '活動履歴', href: '/activities' },
          { label: activityRow.subject },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/activities/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この活動履歴を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      {/* 関連レコード（全関連先を junction から表示） */}
      <div className="mb-4 bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">関連レコード</p>
        {allRelated.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {allRelated.map((r, i) => (
              <Link key={`${r.href}-${i}`} href={r.href} className="text-sm text-blue-600 hover:underline">
                {r.icon} {r.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">紐づくレコードなし</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-sm font-medium ${typeConf.color}`}>
            {typeConf.icon} {typeConf.label}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{activityRow.subject}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {activityRow.occurred_at ? new Date(activityRow.occurred_at).toLocaleString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }) : '—'}
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-3">内容</h2>
        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed min-h-[3rem]">
          {activityRow.body ?? <span className="text-zinc-300">—</span>}
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">メタ情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{activityRow.created_at ? new Date(activityRow.created_at).toLocaleDateString('ja-JP') : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
            <dd className="text-sm text-zinc-800">{ownerName ?? <span className="text-zinc-300">—</span>}</dd>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <dt className="text-xs text-zinc-400 mb-1">人物（複数選択された場合）</dt>
            <dd className="text-sm">
              {linkedContacts.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {linkedContacts.map((c) => (
                    <Link key={c.record_id} href={c.href} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <NavIcon icon="👤" className="w-3.5 h-3.5 shrink-0" /> {c.label}
                    </Link>
                  ))}
                </div>
              ) : <span className="text-zinc-400">—</span>}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
