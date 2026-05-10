import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import EditAutoBodyVehiclePage from '@/industries/auto-body/pages/vehicles/[id]/edit/page'

export default async function EditVehiclePage(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <EditAutoBodyVehiclePage params={props.params} />
}
