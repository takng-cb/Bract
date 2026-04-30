import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ExpenseForm from '@/components/ExpenseForm'
import { createExpense } from '@/app/actions/expenses'

async function createExpenseAction(_: string | null, formData: FormData): Promise<string | null> {
  'use server'
  try { await createExpense(formData); return null }
  catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; opportunity_id?: string; contact_id?: string }>
}) {
  const { account_id, opportunity_id, contact_id } = await searchParams

  const [{ data: accounts }, { data: contacts }, { data: opportunities }] = await Promise.all([
    supabase.from('accounts').select('id, name').eq('status', 'active').order('name'),
    supabase.from('contacts').select('id, full_name').order('full_name'),
    supabase.from('opportunities').select('id, name').order('name'),
  ])

  const cancelHref = opportunity_id
    ? `/opportunities/${opportunity_id}`
    : account_id
    ? `/accounts/${account_id}`
    : '/expenses'

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/expenses" className="hover:text-zinc-600">経費管理</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">経費を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ExpenseForm
          action={createExpenseAction}
          cancelHref={cancelHref}
          accounts={accounts ?? []}
          contacts={contacts ?? []}
          opportunities={opportunities ?? []}
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
