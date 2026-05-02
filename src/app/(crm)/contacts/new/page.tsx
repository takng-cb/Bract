import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { ne, asc } from 'drizzle-orm'
import Link from 'next/link'
import ContactForm from '@/components/ContactForm'
import { createContact } from '@/app/actions/contacts'

async function createContactAction(_: string | null, formData: FormData): Promise<string | null> {
  'use server'
  try { await createContact(formData); return null }
  catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
}

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; view?: string }>
}) {
  const { account_id, view } = await searchParams
  const contactType = view === 'consumer' ? 'consumer' : 'business'

  const accountsList = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts).where(ne(accounts.status, 'inactive')).orderBy(asc(accounts.name))

  const cancelHref = account_id ? `/accounts/${account_id}` : `/contacts?view=${contactType}`

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href={`/contacts?view=${contactType}`} className="hover:text-zinc-600">人物</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        {contactType === 'consumer' ? '個人顧客を追加' : '法人担当者を追加'}
      </h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ContactForm
          action={createContactAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          defaultValues={{ account_id: account_id ?? '', contact_type: contactType }}
        />
      </div>
    </div>
  )
}
