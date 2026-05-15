import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import CustomerVehicleDetailPage from '@/industries/auto-body/pages/customer-vehicles/[id]/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <CustomerVehicleDetailPage params={props.params} />
}
