import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { createCustomRecord } from '@/app/actions/customRecords'
import DynamicForm from '@/components/DynamicForm'
import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { asc } from 'drizzle-orm'

export default async function NewCustomRecordPage({
  params,
}: {
  params: Promise<{ objectApiName: string }>
}) {
  const { objectApiName } = await params
  if (!(await canEdit())) redirect(`/objects/${objectApiName}`)

  const obj = await getObjectDef(objectApiName)
  if (!obj) notFound()

  const fields = await getFieldDefs(obj.id)

  // account_id / contact_id フィールドの有無を確認
  const visibleFields   = fields.filter((f) => f.is_visible)
  const hasAccountField = visibleFields.some(
    (f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')
  )
  const hasContactField = visibleFields.some(
    (f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')
  )

  // 必要な場合のみ取引先・担当者一覧を取得
  const [accountList, contactList] = await Promise.all([
    hasAccountField
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(asc(accounts.name))
      : Promise.resolve([]),
    hasContactField
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).orderBy(asc(contacts.full_name))
      : Promise.resolve([]),
  ])

  async function handleCreate(_prev: unknown, fd: FormData) {
    'use server'
    await createCustomRecord(objectApiName, fd)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/objects/${objectApiName}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← {obj.label_plural}
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">
          {obj.icon} {obj.label}を新規登録
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <DynamicForm
          fields={fields}
          action={handleCreate}
          submitLabel="登録"
          cancelHref={`/objects/${objectApiName}`}
          accountOptions={hasAccountField ? accountList.map((a) => ({ value: a.id, label: a.name })) : undefined}
          contactOptions={hasContactField ? contactList.map((c) => ({ value: c.id, label: c.name })) : undefined}
        />
      </div>
    </div>
  )
}
