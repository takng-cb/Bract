import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import MaintenanceDetailPage from '@/industries/auto-body/pages/maintenance/[id]/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <MaintenanceDetailPage params={props.params} />
}
