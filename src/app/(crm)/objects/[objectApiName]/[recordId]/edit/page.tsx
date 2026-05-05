import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { db } from '@/lib/db'
import { custom_records } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
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
        />
      </div>
    </div>
  )
}
