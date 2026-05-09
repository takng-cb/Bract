import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import NewAutoBodyVehiclePage from '@/industries/auto-body/pages/vehicles/new/page'

export default async function NewVehiclePage() {
  if (activeIndustry !== 'auto-body') notFound()
  return <NewAutoBodyVehiclePage />
}
