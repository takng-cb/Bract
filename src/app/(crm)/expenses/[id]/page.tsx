import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import DeleteButton from '@/components/DeleteButton'

const CATEGORY_COLORS: Record<string, string> = {
  交通費:  'bg-blue-50 text-blue-700 border-blue-200',
  接待費:  'bg-purple-50 text-purple-700 border-purple-200',
  通信費:  'bg-cyan-50 text-cyan-700 border-cyan-200',
  消耗品費: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  広告費:  'bg-orange-50 text-orange-700 border-orange-200',
  外注費:  'bg-red-50 text-red-700 border-red-200',
  その他:  'bg-zinc-100 text-zinc-600 border-zinc-200',
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: expense } = await supabase
    .from('expenses')
    .select('*, accounts(id, name), contacts(id, full_name), opportunities(id, name)')
    .eq('id', id)
    .single()

  if (!expense) notFound()

  const account     = expense.accounts     as unknown as { id: string; name: string } | null
  const contact     = expense.contacts     as unknown as { id: string; full_name: string } | null
  const opportunity = expense.opportunities as unknown as { id: string; name: string } | null
  const catColor    = CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS['その他']

  async function deleteAction() {
    'use server'
    const { data: exp } = await supabase.from('expenses').select('opportunity_id').eq('id', id).single()
    await supabase.from('expenses').delete().eq('id', id)
    revalidatePath('/expenses')
    if (exp?.opportunity_id) revalidatePath(`/opportunities/${exp.opportunity_id}`)
    const { redirect } = await import('next/navigation')
    redirect('/expenses')
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/expenses" className="hover:text-zinc-600">経費管理</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 line-clamp-1">{expense.title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-sm font-medium ${catColor}`}>
              {expense.category}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">{expense.title}</h1>
          <p className="text-2xl font-bold text-blue-600 mt-1">¥{Number(expense.amount).toLocaleString()}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/expenses/${id}/edit`}
            className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
          >
            編集
          </Link>
          <DeleteButton
            action={deleteAction}
            confirmMessage="この経費を削除しますか？"
          />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">詳細情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">日付</dt>
            <dd className="text-sm text-zinc-800">{expense.expense_date}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">カテゴリ</dt>
            <dd className="text-sm text-zinc-800">{expense.category}</dd>
          </div>
          {account && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
              <dd className="text-sm">
                <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">🏢 {account.name}</Link>
              </dd>
            </div>
          )}
          {contact && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
              <dd className="text-sm">
                <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">👤 {contact.full_name}</Link>
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
            <dd className="text-sm text-zinc-800">{new Date(expense.created_at).toLocaleDateString('ja-JP')}</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">備考</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {expense.notes ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>
      </div>
    </div>
  )
}
