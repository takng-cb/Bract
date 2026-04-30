import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OpportunityForm from '@/components/OpportunityForm'
import { updateOpportunity } from '@/app/actions/opportunities'

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data: opportunity }, { data: accounts }] = await Promise.all([
    supabase.from('opportunities').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').eq('status', 'active').order('name'),
  ])
  if (!opportunity) notFound()

  async function updateOpportunityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateOpportunity(id, formData); return null }
    catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
  }

  return (
    <div className="p-8 max-w-2xl">
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
          accounts={accounts ?? []}
          defaultValues={{ ...opportunity, close_date: opportunity.close_date ?? null }}
        />
      </div>
    </div>
  )
}
