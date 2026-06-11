import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewCustomerVehiclePage from '@/industries/auto-body/pages/customer-vehicles/new/page'
import type { ComponentProps } from 'react'
import { requireBookRead } from '@/lib/permissions'

export default async function Page(props: ComponentProps<typeof NewCustomerVehiclePage>) {
  await requireBookRead('customer_vehicles')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewCustomerVehiclePage {...props} />
}
