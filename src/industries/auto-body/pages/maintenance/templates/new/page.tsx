import Breadcrumbs from '@/components/Breadcrumbs'
import MaintenanceTemplateForm from '@/industries/auto-body/components/MaintenanceTemplateForm'
import { createTemplate } from '@/industries/auto-body/actions/maintenanceTemplates'
import { requireEditor } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function NewTemplatePage() {
  await requireEditor()

  async function createAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try {
      const id = await createTemplate(formData)
      redirect(`/maintenance/templates/${id}`)
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '整備', href: '/maintenance' },
        { label: '整備パッケージ', href: '/maintenance/templates' },
        { label: '新規作成' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">整備パッケージを作成</h1>
      <MaintenanceTemplateForm action={createAction} cancelHref="/maintenance/templates" />
    </div>
  )
}
