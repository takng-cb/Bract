import { db } from '@/lib/db'
import { expenses, accounts, contacts, opportunities } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ExpenseForm from '@/components/ExpenseForm'
import { updateExpense } from '@/app/actions/expenses'
import { requireEditor } from '@/lib/auth'

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const [expense, accountsList, contactsList, opportunitiesList] = await Promise.all([
    db.select().from(expenses).where(eq(expenses.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
  ])
  if (!expense) notFound()

  async function updateExpenseAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateExpense(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/expenses" className="hover:text-zinc-600">経費管理</Link>
        <span className="mx-2">/</span>
        <Link href={`/expenses/${id}`} className="hover:text-zinc-600 line-clamp-1">{expense.title}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">経費を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ExpenseForm
          action={updateExpenseAction}
          cancelHref={`/expenses/${id}`}
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          defaultValues={{
            ...expense,
            amount: expense.amount !== null ? Number(expense.amount) : null,
          }}
        />
      </div>
    </div>
  )
}
