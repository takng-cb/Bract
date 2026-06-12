import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { ne, asc } from 'drizzle-orm'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import ContactForm from '@/components/ContactForm'
import RecordHeader from '@/components/RecordHeader'
import { createContact } from '@/app/actions/contacts'
import { saveCustomFieldValues } from '@/app/actions/customFieldValues'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import { runCreate } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; view?: string }>
}) {
  await requireBookRead('contacts')  // RBAC: Read 権限ガード（ADR-0023）
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

  async function createContactAction(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    return runCreate({
      objectKey: 'contacts',
      objectLabel: '人物',
      formData,
      create: () => createContact(formData),
      afterCreate: fields.length > 0 ? (id) => saveCustomFieldValues('contacts', id, formData) : undefined,
      redirectTo: (id) => `/contacts/${id}`,
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[
          { label: '人物', href: `/contacts?view=${contactType}` },
          { label: '新規作成' },
        ]}
        avatar={<UserRound className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title="人物を追加"
        actions={
          <div className="flex items-center gap-2">
            <Link href={cancelHref} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form={FORM_ID}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        }
      />

      <ContactForm
        action={createContactAction}
        cancelHref={cancelHref}
        accounts={accountsList}
        users={allUsers}
        defaultValues={{ account_id: account_id ?? '', contact_type: contactType }}
        customFields={fields}
        formId={FORM_ID}
      />
    </div>
  )
}
