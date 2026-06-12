import { getBookDef, getFieldDefs } from '@/lib/bookMetadata'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { createCustomRecord } from '@/app/actions/customRecords'
import { checkDuplicates } from '@/lib/duplicateCheck'
import type { CreateState } from '@/lib/duplicateTypes'
import DynamicForm from '@/components/DynamicForm'
import RecordHeader from '@/components/RecordHeader'
import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import { getAllUsers } from '@/lib/userUtils'
import { requireBookRead } from '@/lib/permissions'

const FORM_ID = 'record-create-form'

export default async function NewCustomRecordPage({
  params,
}: {
  params: Promise<{ objectApiName: string }>
}) {
  const { objectApiName } = await params
  await requireBookRead(objectApiName)  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await canEdit())) redirect(`/books/${objectApiName}`)

  const obj = await getBookDef(objectApiName)
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

  async function handleCreate(_prev: unknown, fd: FormData): Promise<CreateState> {
    'use server'
    const dups = await checkDuplicates(`custom:${objectApiName}`, fd)
    if (dups.length > 0) return { kind: 'duplicate', objectLabel: obj!.label, candidates: dups }
    await createCustomRecord(objectApiName, fd)   // 成功時は内部で redirect、失敗時は throw（DynamicForm が捕捉）
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* 詳細ページと同じヒーローヘッダ（REQ-0051）。保存はフォームに form 属性で紐付け */}
      <RecordHeader
        crumbs={[{ label: obj.label_plural, href: `/books/${objectApiName}` }, { label: '新規登録' }]}
        avatar={<span className="text-2xl leading-none" aria-hidden>{obj.icon}</span>}
        title={`${obj.label}を新規登録`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/books/${objectApiName}`} className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              form={FORM_ID}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              登録
            </button>
          </div>
        }
      />

      <DynamicForm
        variant="record"
        formId={FORM_ID}
        fields={fields}
        action={handleCreate}
        submitLabel="登録"
        cancelHref={`/books/${objectApiName}`}
        accountOptions={hasAccountField ? accountList.map((a) => ({ value: a.id, label: a.name })) : undefined}
        contactOptions={hasContactField ? contactList.map((c) => ({ value: c.id, label: c.name })) : undefined}
        userOptions={allUsers.map((u) => ({ value: u.id, label: u.name }))}
      />
    </div>
  )
}
