import { db } from '@/lib/db'
import { maintenance_templates } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import MaintenanceTemplateForm from '@/industries/auto-body/components/MaintenanceTemplateForm'
import { updateTemplate } from '@/industries/auto-body/actions/maintenanceTemplates'
import { requireEditor } from '@/lib/auth'

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditor()
  const t = await db.select().from(maintenance_templates).where(eq(maintenance_templates.id, id)).then((r) => r[0] ?? null)
  if (!t) notFound()

  async function updateAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateTemplate(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '整備', href: '/maintenance' },
        { label: '整備パッケージ', href: '/maintenance/templates' },
        { label: t.name, href: `/maintenance/templates/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">整備パッケージを編集</h1>
      <MaintenanceTemplateForm
        action={updateAction}
        cancelHref={`/maintenance/templates/${id}`}
        defaultValues={{
          name:        t.name,
          description: t.description,
          category:    t.category,
          is_active:   t.is_active,
          sort_order:  t.sort_order,
        }}
      />
    </div>
  )
}
