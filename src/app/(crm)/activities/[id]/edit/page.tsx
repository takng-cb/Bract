import { db } from '@/lib/db'
import { activities, accounts, contacts, opportunities, activity_contacts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ActivityForm from '@/components/ActivityForm'
import { updateActivity } from '@/app/actions/activities'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [activity, accountsList, contactsList, opportunitiesList, activityContactRows] = await Promise.all([
    db.select().from(activities).where(eq(activities.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
    db.select({ contact_id: activity_contacts.contact_id })
      .from(activity_contacts).where(eq(activity_contacts.activity_id, id)),
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

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/activities" className="hover:text-zinc-600">活動履歴</Link>
        <span className="mx-2">/</span>
        <Link href={`/activities/${id}`} className="hover:text-zinc-600 line-clamp-1">{activity.subject}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">活動を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ActivityForm
          action={updateActivityAction}
          cancelHref={`/activities/${id}`}
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          defaultValues={{
            type: activity.type,
            subject: activity.subject,
            body: activity.body,
            occurred_at: activity.occurred_at
              ? new Date(activity.occurred_at).toISOString().slice(0, 16)
              : '',
            account_id: activity.account_id ?? '',
            contact_ids: activityContactRows.map((ac) => ac.contact_id),
            opportunity_id: activity.opportunity_id ?? '',
          }}
        />
      </div>
    </div>
  )
}
