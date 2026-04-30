import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ContactForm from '@/components/ContactForm'
import { updateContact } from '@/app/actions/contacts'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data: contact }, { data: accounts }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').eq('status', 'active').order('name'),
  ])
  if (!contact) notFound()

  async function updateContactAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateContact(id, formData); return null }
    catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/contacts" className="hover:text-zinc-600">担当者</Link>
        <span className="mx-2">/</span>
        <Link href={`/contacts/${id}`} className="hover:text-zinc-600">{contact.full_name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">担当者を編集</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ContactForm action={updateContactAction} cancelHref={`/contacts/${id}`} accounts={accounts ?? []} defaultValues={contact} />
      </div>
    </div>
  )
}
