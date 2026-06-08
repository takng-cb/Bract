import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import TemplatesPage from '@/industries/auto-body/pages/maintenance/templates/page'

export default async function Page() {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <TemplatesPage />
}
