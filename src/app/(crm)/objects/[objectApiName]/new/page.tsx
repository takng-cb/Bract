import { getObjectDef, getFieldDefs } from '@/lib/objectMetadata'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { canEdit } from '@/lib/auth'
import { createCustomRecord } from '@/app/actions/customRecords'
import DynamicForm from '@/components/DynamicForm'

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
        />
      </div>
    </div>
  )
}
