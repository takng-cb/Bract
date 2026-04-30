import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ExpenseForm from '@/components/ExpenseForm'
import { updateExpense } from '@/app/actions/expenses'

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: expense }, { data: accounts }, { data: contacts }, { data: opportunities }] = await Promise.all([
    supabase.from('expenses').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').eq('status', 'active').order('name'),
    supabase.from('contacts').select('id, full_name').order('full_name'),
    supabase.from('opportunities').select('id, name').order('name'),
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
    <div className="p-8 max-w-2xl">
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
          accounts={accounts ?? []}
          contacts={contacts ?? []}
          opportunities={opportunities ?? []}
          defaultValues={expense}
        />
      </div>
    </div>
  )
}
