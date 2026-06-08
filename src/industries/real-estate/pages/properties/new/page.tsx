import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { ne, eq, and, asc } from 'drizzle-orm'
import Link from 'next/link'
import PropertyForm from '@/industries/real-estate/components/PropertyForm'
import { createProperty } from '@/industries/real-estate/actions/properties'
import { requireEditor } from '@/lib/auth'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const category = view === 'other' ? 'other' : 'real_estate'
  await requireEditor()
  // properties は real-estate overlay の専用 UI で全フィールドを扱うため、
  // 汎用カスタムフィールドシステムは使わない（edit ページと同様）。
  const [accountsList, contactsList, scrivenerAccounts, scrivenerContacts] = await Promise.all([
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
  ])

  async function createPropertyAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'properties',
      objectLabel: '物件・商品',
      formData,
      create: () => createProperty(formData),
      redirectTo: (id) => `/properties/${id}`,
    })
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
        />
      </div>
    </div>
  )
}
