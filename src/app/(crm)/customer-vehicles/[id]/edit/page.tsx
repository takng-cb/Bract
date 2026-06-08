import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditCustomerVehiclePage from '@/industries/auto-body/pages/customer-vehicles/[id]/edit/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditCustomerVehiclePage params={props.params} />
}
