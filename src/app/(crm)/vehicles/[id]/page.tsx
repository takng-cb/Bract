import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyVehicleDetail from '@/industries/auto-body/pages/vehicles/[id]/page'

export default async function VehicleDetailPage(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyVehicleDetail params={props.params} />
}
