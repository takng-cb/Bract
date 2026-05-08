import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { ne, eq, and, asc } from 'drizzle-orm'
import Link from 'next/link'
import PropertyForm from '@/industries/real-estate/components/PropertyForm'
import { createProperty } from '@/industries/real-estate/actions/properties'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const category = view === 'other' ? 'other' : 'real_estate'
  await requireEditor()
  const [accountsList, contactsList, scrivenerAccounts, scrivenerContacts, { fields }] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(ne(accounts.status, 'inactive')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    // 業種=司法書士の取引先
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.industry, '司法書士'), ne(accounts.status, 'inactive')))
      .orderBy(asc(accounts.name)),
    // 業種=司法書士の取引先に紐づくToBの担当者
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts)
      .innerJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(and(eq(contacts.contact_type, 'business'), eq(accounts.industry, '司法書士')))
      .orderBy(asc(contacts.full_name)),
    getCustomFieldsWithValues('properties', ''),
  ])

  async function createPropertyAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const newId = await createProperty(formData)
      if (fields.length > 0) await saveCustomFieldValues('properties', newId, formData)
      redirect(`/properties/${newId}`)
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href={`/properties?view=${category}`} className="hover:text-zinc-600">物件・商品</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規登録</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        {category === 'real_estate' ? '物件を登録' : '商品を登録'}
      </h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <PropertyForm
          action={createPropertyAction}
          cancelHref={`/properties?view=${category}`}
          accounts={accountsList}
          contacts={contactsList}
          scrivenerAccounts={scrivenerAccounts}
          scrivenerContacts={scrivenerContacts}
          defaultValues={{ product_category: category }}
          customFields={fields}
        />
      </div>
    </div>
  )
}
