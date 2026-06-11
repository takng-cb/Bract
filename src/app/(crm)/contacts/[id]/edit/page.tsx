import { db } from '@/lib/db'
import { contacts, accounts } from '@/lib/schema'
import { ne, asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ContactForm from '@/components/ContactForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateContact } from '@/app/actions/contacts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('contacts')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  await requireEditor()
  const [contact, accountsList, customData, allUsers] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(ne(accounts.status, 'inactive')).orderBy(asc(accounts.name)),
    getCustomFieldsWithValues('contacts', id),
    getAllUsers(),
  ])
  if (!contact) notFound()

  const view = contact.contact_type === 'consumer' ? 'consumer' : 'business'

  async function updateContactAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await saveCustomFieldValues('contacts', id, formData)
      await updateContact(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '人物', href: `/contacts?view=${view}` },
        { label: contact.full_name, href: `/contacts/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">人物を編集</h1>
      <ContactForm
        action={updateContactAction}
        cancelHref={`/contacts/${id}`}
        accounts={accountsList}
        users={allUsers}
        defaultValues={contact}
        customFields={customData.fields}
        customValues={customData.values}
      />
    </div>
  )
}
