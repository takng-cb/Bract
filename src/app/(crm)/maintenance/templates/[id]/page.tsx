import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import TemplateDetailPage from '@/industries/auto-body/pages/maintenance/templates/[id]/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <TemplateDetailPage params={props.params} />
}
