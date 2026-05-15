import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import CustomerVehiclesListPage from '@/industries/auto-body/pages/customer-vehicles/page'

export default async function Page() {
  if (activeIndustry !== 'auto-body') notFound()
  return <CustomerVehiclesListPage />
}
