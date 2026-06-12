import { getBookDef, getFieldDefs } from '@/lib/bookMetadata'
import { db } from '@/lib/db'
import { book_records, accounts, contacts } from '@/lib/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { updateCustomRecord } from '@/app/actions/customRecords'
import DynamicForm from '@/components/DynamicForm'
import RecordHeader from '@/components/RecordHeader'
import { getAllUsers } from '@/lib/userUtils'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

export default async function EditCustomRecordPage({
  params,
}: {
  params: Promise<{ objectApiName: string; recordId: string }>
}) {
  const { objectApiName, recordId } = await params
  await requireBookRead(objectApiName)  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await canEdit())) redirect(`/books/${objectApiName}/${recordId}`)

  const obj = await getBookDef(objectApiName)
  if (!obj) notFound()

  const [record, fields] = await Promise.all([
    db.select().from(book_records)
      .where(and(eq(book_records.id, recordId), eq(book_records.object_id, obj.id)))
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
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[
          { label: obj.label_plural, href: `/books/${objectApiName}` },
          { label: `${obj.label}詳細`, href: `/books/${objectApiName}/${recordId}` },
          { label: '編集' },
        ]}
        avatar={<span className="text-2xl leading-none" aria-hidden>{obj.icon}</span>}
        title={`${obj.label}を編集`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/books/${objectApiName}/${recordId}`} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
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

      <DynamicForm
        variant="record"
        formId={FORM_ID}
        fields={fields}
        defaultValues={defaultValues}
        action={handleUpdate}
        submitLabel="保存"
        cancelHref={`/books/${objectApiName}/${recordId}`}
        accountOptions={hasAccountField ? accountList.map((a) => ({ value: a.id, label: a.name })) : undefined}
        contactOptions={hasContactField ? contactList.map((c) => ({ value: c.id, label: c.name })) : undefined}
        userOptions={allUsers.map((u) => ({ value: u.id, label: u.name }))}
        defaultOwnerId={record.owner_id ?? null}
      />
    </div>
  )
}
