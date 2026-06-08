import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditTemplatePage from '@/industries/auto-body/pages/maintenance/templates/[id]/edit/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditTemplatePage params={props.params} />
}
