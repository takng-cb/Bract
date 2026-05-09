import { db } from '@/lib/db'
import { accounts, contacts, opportunities } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import ExpenseForm from '@/components/ExpenseForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createExpense } from '@/app/actions/expenses'
import { requireEditor } from '@/lib/auth'

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; opportunity_id?: string; contact_id?: string; custom_record_id?: string; return_to?: string }>
}) {
  const { account_id, opportunity_id, contact_id, custom_record_id, return_to } = await searchParams

  async function createExpenseAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    if (custom_record_id) formData.set('custom_record_id', custom_record_id)
    if (return_to)        formData.set('return_to', return_to)
    try { await createExpense(formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }
  await requireEditor()
  const [accountsList, contactsList, opportunitiesList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
  ])

  const cancelHref = return_to
    ?? (opportunity_id
    ? `/opportunities/${opportunity_id}`
    : account_id
    ? `/accounts/${account_id}`
    : '/expenses')

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '経費管理', href: '/expenses' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">経費を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ExpenseForm
          action={createExpenseAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          defaultValues={{
            account_id: account_id ?? '',
            contact_id: contact_id ?? '',
            opportunity_id: opportunity_id ?? '',
          }}
        />
      </div>
    </div>
  )
}
