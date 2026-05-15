import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import EditCustomerVehiclePage from '@/industries/auto-body/pages/customer-vehicles/[id]/edit/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <EditCustomerVehiclePage params={props.params} />
}
