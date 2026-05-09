import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { ne, asc } from 'drizzle-orm'
import ContactForm from '@/components/ContactForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createContact } from '@/app/actions/contacts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; view?: string }>
}) {
  const { account_id, view } = await searchParams
  const contactType = view === 'consumer' ? 'consumer' : 'business'
  await requireEditor()
  const [accountsList, { fields }, allUsers] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(ne(accounts.status, 'inactive')).orderBy(asc(accounts.name)),
    getCustomFieldsWithValues('contacts', ''),
    getAllUsers(),
  ])

  const cancelHref = account_id ? `/accounts/${account_id}` : `/contacts?view=${contactType}`

  async function createContactAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const newId = await createContact(formData)
      if (fields.length > 0) await saveCustomFieldValues('contacts', newId, formData)
      redirect(`/contacts/${newId}`)
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '人物', href: `/contacts?view=${contactType}` },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        {contactType === 'consumer' ? '個人顧客を追加' : '法人担当者を追加'}
      </h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ContactForm
          action={createContactAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          users={allUsers}
          defaultValues={{ account_id: account_id ?? '', contact_type: contactType }}
          customFields={fields}
        />
      </div>
    </div>
  )
}
