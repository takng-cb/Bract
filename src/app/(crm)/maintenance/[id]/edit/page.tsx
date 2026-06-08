import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditMaintenancePage from '@/industries/auto-body/pages/maintenance/[id]/edit/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditMaintenancePage params={props.params} />
}
