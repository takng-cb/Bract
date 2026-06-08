import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditAutoBodyVehiclePage from '@/industries/auto-body/pages/vehicles/[id]/edit/page'

export default async function EditVehiclePage(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditAutoBodyVehiclePage params={props.params} />
}
