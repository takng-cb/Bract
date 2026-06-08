import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import CustomerVehicleDetailPage from '@/industries/auto-body/pages/customer-vehicles/[id]/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <CustomerVehicleDetailPage params={props.params} />
}
