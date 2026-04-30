import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ActivityForm from '@/components/ActivityForm'
import { updateActivity } from '@/app/actions/activities'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: activity }, { data: accounts }, { data: contacts }, { data: opportunities }, { data: activityContacts }] = await Promise.all([
    supabase.from('activities').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').eq('status', 'active').order('name'),
    supabase.from('contacts').select('id, full_name').order('full_name'),
    supabase.from('opportunities').select('id, name').order('name'),
    supabase.from('activity_contacts').select('contact_id').eq('activity_id', id),
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
          accounts={accounts ?? []}
          contacts={contacts ?? []}
          opportunities={opportunities ?? []}
          defaultValues={{
            type: activity.type,
            subject: activity.subject,
            body: activity.body,
            occurred_at: activity.occurred_at,
            account_id: activity.account_id ?? '',
            contact_ids: (activityContacts ?? []).map((ac) => ac.contact_id),
            opportunity_id: activity.opportunity_id ?? '',
          }}
        />
      </div>
    </div>
  )
}
