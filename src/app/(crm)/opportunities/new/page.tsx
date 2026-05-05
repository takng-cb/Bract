import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import OpportunityForm from '@/components/OpportunityForm'
import { createOpportunity } from '@/app/actions/opportunities'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string }>
}) {
  const { account_id } = await searchParams
  await requireEditor()
  const [accountsList, { fields }] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getCustomFieldsWithValues('opportunities', ''),
  ])

  const cancelHref = account_id ? `/accounts/${account_id}` : '/opportunities'

  async function createOpportunityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const newId = await createOpportunity(formData)
      if (fields.length > 0) await saveCustomFieldValues('opportunities', newId, formData)
      redirect(`/opportunities/${newId}`)
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
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">商談を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <OpportunityForm
          action={createOpportunityAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          defaultValues={{ account_id: account_id ?? '' }}
          customFields={fields}
        />
      </div>
    </div>
  )
}
