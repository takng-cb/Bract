import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import AutoBodyVehicleDetail from '@/industries/auto-body/pages/vehicles/[id]/page'

export default async function VehicleDetailPage(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <AutoBodyVehicleDetail params={props.params} />
}
