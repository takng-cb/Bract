import { db } from '@/lib/db'
import { contacts, accounts } from '@/lib/schema'
import { ne, asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import ContactForm from '@/components/ContactForm'
import RecordHeader from '@/components/RecordHeader'
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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051） */}
      <RecordHeader
        crumbs={[
          { label: '人物', href: `/contacts?view=${view}` },
          { label: contact.full_name, href: `/contacts/${id}` },
          { label: '編集' },
        ]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={`${contact.full_name} を編集`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/contacts/${id}`} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form="record-create-form"
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        }
      />
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
