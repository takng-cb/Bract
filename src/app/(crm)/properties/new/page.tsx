import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import PropertyForm from '@/components/PropertyForm'
import { createProperty } from '@/app/actions/properties'

async function createPropertyAction(_: string | null, formData: FormData): Promise<string | null> {
  'use server'
  try { await createProperty(formData); return null }
  catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return (e as Error).message
  }
}

export default async function NewPropertyPage() {
  const [accountsList, contactsList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
  ])

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/properties" className="hover:text-zinc-600">不動産物件</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規登録</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">物件を登録</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <PropertyForm
          action={createPropertyAction}
          cancelHref="/properties"
          accounts={accountsList}
          contacts={contactsList}
        />
      </div>
    </div>
  )
}
