import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
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
  searchParams: Promise<{ account_id?: string }>
}) {
  const { account_id } = await searchParams
  const accountsList = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name))

  // 取引先から遷移してきた場合はその取引先詳細に戻る
  const cancelHref = account_id ? `/accounts/${account_id}` : '/contacts'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/contacts" className="hover:text-zinc-600">担当者</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">担当者を追加</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ContactForm
          action={createContactAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          defaultValues={{ account_id: account_id ?? '' }}
        />
      </div>
    </div>
  )
}
