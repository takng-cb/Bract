import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewTemplatePage from '@/industries/auto-body/pages/maintenance/templates/new/page'

export default async function Page() {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewTemplatePage />
}
