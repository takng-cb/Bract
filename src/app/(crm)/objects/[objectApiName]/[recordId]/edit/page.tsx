import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records, accounts, contacts } from '@/lib/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { updateCustomRecord } from '@/app/actions/customRecords'
import DynamicForm from '@/components/DynamicForm'

export default async function EditCustomRecordPage({
  params,
}: {
  params: Promise<{ objectApiName: string; recordId: string }>
}) {
  const { objectApiName, recordId } = await params
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

  let defaultValues: Record<string, unknown> = {}
  try { defaultValues = JSON.parse(record.data) } catch { /* ignore */ }

  // ── account_id / contact_id の UUID → 名前を解決 ──
  const visibleFields = fields.filter((f) => f.is_visible)
  const accountIdFields = visibleFields.filter(
    (f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')
  )
  const contactIdFields = visibleFields.filter(
    (f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')
  )

  const accountIds = accountIdFields
    .map((f) => String(defaultValues[f.api_name] ?? '').trim())
    .filter(Boolean)
  const contactIds = contactIdFields
    .map((f) => String(defaultValues[f.api_name] ?? '').trim())
    .filter(Boolean)

  const [accountRows, contactRows] = await Promise.all([
    accountIds.length > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds))
      : Promise.resolve([]),
    contactIds.length > 0
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).where(inArray(contacts.id, contactIds))
      : Promise.resolve([]),
  ])
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))
  const contactMap = new Map(contactRows.map((c) => [c.id, c.name]))

  // api_name → 表示名のマップ（RecordSearchInput の defaultLabel に使用）
  const defaultLabels: Record<string, string> = {}
  for (const f of accountIdFields) {
    const id = String(defaultValues[f.api_name] ?? '').trim()
    if (id && accountMap.has(id)) defaultLabels[f.api_name] = accountMap.get(id)!
  }
  for (const f of contactIdFields) {
    const id = String(defaultValues[f.api_name] ?? '').trim()
    if (id && contactMap.has(id)) defaultLabels[f.api_name] = contactMap.get(id)!
  }

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
          defaultLabels={defaultLabels}
          action={handleUpdate}
          submitLabel="保存"
          cancelHref={`/objects/${objectApiName}/${recordId}`}
        />
      </div>
    </div>
  )
}
