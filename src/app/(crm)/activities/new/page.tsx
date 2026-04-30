import { db } from '@/lib/db'
import { accounts, contacts, opportunities } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import ActivityForm from '@/components/ActivityForm'
import { createActivity } from '@/app/actions/activities'

async function createActivityAction(_: string | null, formData: FormData): Promise<string | null> {
  'use server'
  try { await createActivity(formData); return null }
  catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
}

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string }>
}) {
  const { account_id, contact_id, opportunity_id } = await searchParams

  // contact_id / opportunity_id から account_id を補完する
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

  const [accountsList, contactsList, opportunitiesList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
  ])

  const cancelHref = account_id
    ? `/accounts/${account_id}`
    : contact_id
    ? `/contacts/${contact_id}`
    : opportunity_id
    ? `/opportunities/${opportunity_id}`
    : '/activities'

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/activities" className="hover:text-zinc-600">活動履歴</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">活動を記録</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ActivityForm
          action={createActivityAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          defaultValues={{
            account_id: resolvedAccountId,
            contact_ids: contact_id ? [contact_id] : [],
            opportunity_id: opportunity_id ?? '',
          }}
        />
      </div>
    </div>
  )
}
