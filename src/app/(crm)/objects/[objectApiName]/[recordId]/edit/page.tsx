import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records, accounts, contacts } from '@/lib/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { updateCustomRecord } from '@/app/actions/customRecords'
import DynamicForm from '@/components/DynamicForm'
import { getAllUsers } from '@/lib/userUtils'
import { requireBookRead } from '@/lib/permissions'

export default async function EditCustomRecordPage({
  params,
}: {
  params: Promise<{ objectApiName: string; recordId: string }>
}) {
  const { objectApiName, recordId } = await params
  await requireBookRead(objectApiName)  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await canEdit())) redirect(`/objects/${objectApiName}/${recordId}`)

  const obj = await getObjectDef(objectApiName)
  if (!obj) notFound()

  const [record, fields] = await Promise.all([
    db.select().from(custom_records)
      .where(and(eq(custom_records.id, recordId), eq(custom_records.object_id, obj.id)))
      .then((r) => r[0] ?? null),
    getFieldDefs(obj.id),
  ])
  if (!record) notFound()

  const defaultValues: Record<string, unknown> = record.data ?? {}

  // account_id / contact_id フィールドの有無を確認
  const visibleFields   = fields.filter((f) => f.is_visible)
  const hasAccountField = visibleFields.some(
    (f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')
  )
  const hasContactField = visibleFields.some(
    (f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')
  )

  // 必要な場合のみ取引先・担当者一覧を取得、ユーザー一覧は常に取得
  const [accountList, contactList, allUsers] = await Promise.all([
    hasAccountField
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(asc(accounts.name))
      : Promise.resolve([]),
    hasContactField
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).orderBy(asc(contacts.full_name))
      : Promise.resolve([]),
    getAllUsers(),
  ])

  async function handleUpdate(_prev: unknown, fd: FormData) {
    'use server'
    await updateCustomRecord(objectApiName, recordId, fd)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/objects/${objectApiName}/${recordId}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← {obj.label}詳細
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">
          {obj.icon} {obj.label}を編集
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <DynamicForm
          fields={fields}
          defaultValues={defaultValues}
          action={handleUpdate}
          submitLabel="保存"
          cancelHref={`/objects/${objectApiName}/${recordId}`}
          accountOptions={hasAccountField ? accountList.map((a) => ({ value: a.id, label: a.name })) : undefined}
          contactOptions={hasContactField ? contactList.map((c) => ({ value: c.id, label: c.name })) : undefined}
          userOptions={allUsers.map((u) => ({ value: u.id, label: u.name }))}
          defaultOwnerId={record.owner_id ?? null}
        />
      </div>
    </div>
  )
}
