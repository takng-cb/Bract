import { db } from '@/lib/db'
import { activities, accounts, opportunities, activity_contacts, contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteActivity } from '@/app/actions/activities'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  call:    { label: '電話',   icon: '📞', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  email:   { label: 'メール', icon: '✉️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  meeting: { label: '打合せ', icon: '🤝', color: 'bg-green-50 text-green-700 border-green-200' },
  note:    { label: 'メモ',   icon: '📝', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [activityRow, linkedContactRows] = await Promise.all([
    db.select({
      id: activities.id, type: activities.type, subject: activities.subject,
      body: activities.body, occurred_at: activities.occurred_at, created_at: activities.created_at,
      accounts:      { id: accounts.id, name: accounts.name },
      opportunities: { id: opportunities.id, name: opportunities.name },
    })
      .from(activities)
      .leftJoin(accounts, eq(activities.account_id, accounts.id))
      .leftJoin(opportunities, eq(activities.opportunity_id, opportunities.id))
      .where(eq(activities.id, id))
      .then((r) => r[0] ?? null),
    db.select({ contact_id: activity_contacts.contact_id, full_name: contacts.full_name })
      .from(activity_contacts)
      .innerJoin(contacts, eq(activity_contacts.contact_id, contacts.id))
      .where(eq(activity_contacts.activity_id, id)),
  ])

  if (!activityRow) notFound()

  const account     = activityRow.accounts?.id     ? activityRow.accounts     : null
  const opportunity = activityRow.opportunities?.id ? activityRow.opportunities : null
  const typeConf    = TYPE_CONFIG[activityRow.type] ?? { label: activityRow.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600 border-zinc-200' }

  async function handleDelete() {
    'use server'
    await deleteActivity(id)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/activities" className="hover:text-zinc-600">活動履歴</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 line-clamp-1">{activityRow.subject}</span>
      </div>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <Link href={`/activities/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">編集</Link>
            <DeleteButton action={handleDelete} confirmMessage="この活動履歴を削除しますか？" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">内容</h2>
        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed min-h-[3rem]">
          {activityRow.body ?? <span className="text-zinc-300">—</span>}
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">関連情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {account && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
              <dd className="text-sm">
                <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">🏢 {account.name}</Link>
              </dd>
            </div>
          )}
          {linkedContactRows.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
              <dd className="flex flex-wrap gap-2 mt-1">
                {linkedContactRows.map((c) => (
                  <Link key={c.contact_id} href={`/contacts/${c.contact_id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    👤 {c.full_name}
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {opportunity && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">商談</dt>
              <dd className="text-sm">
                <Link href={`/opportunities/${opportunity.id}`} className="text-blue-600 hover:underline">💼 {opportunity.name}</Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{activityRow.created_at ? new Date(activityRow.created_at).toLocaleDateString('ja-JP') : '—'}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
