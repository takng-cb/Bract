import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditCustomerVehiclePage from '@/industries/auto-body/pages/customer-vehicles/[id]/edit/page'
import { requireBookRead } from '@/lib/permissions'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('customer_vehicles')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditCustomerVehiclePage params={props.params} />
}
