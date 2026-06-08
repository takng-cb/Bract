import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewAutoBodyVehiclePage from '@/industries/auto-body/pages/vehicles/new/page'

export default async function NewVehiclePage() {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewAutoBodyVehiclePage />
}
