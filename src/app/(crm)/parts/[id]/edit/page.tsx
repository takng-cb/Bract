import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditAutoBodyPartPage from '@/industries/auto-body/pages/parts/[id]/edit/page'

export default async function EditPartPage(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditAutoBodyPartPage params={props.params} />
}
