import { db } from '@/lib/db'
import { opportunities, accounts, contacts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OpportunityForm from '@/components/OpportunityForm'
import { updateOpportunity } from '@/app/actions/opportunities'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { requireEditor } from '@/lib/auth'

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [opportunity, accountsList, contactsList, customData] = await Promise.all([
    db.select().from(opportunities).where(eq(opportunities.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    getCustomFieldsWithValues('opportunities', id),
  ])
  if (!opportunity) notFound()

  async function updateOpportunityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      await saveCustomFieldValues('opportunities', id, formData)
      await updateOpportunity(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/opportunities" className="hover:text-zinc-600">商談</Link>
        <span className="mx-2">/</span>
        <Link href={`/opportunities/${id}`} className="hover:text-zinc-600">{opportunity.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">商談を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <OpportunityForm
          action={updateOpportunityAction}
          cancelHref={`/opportunities/${id}`}
          accounts={accountsList}
          contacts={contactsList}
          defaultValues={{
            ...opportunity,
            close_date: opportunity.close_date ?? null,
            amount: opportunity.amount !== null ? Number(opportunity.amount) : null,
          }}
          customFields={customData.fields}
          customValues={customData.values}
        />
      </div>
    </div>
  )
}
