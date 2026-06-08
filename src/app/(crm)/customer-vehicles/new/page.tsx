import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewCustomerVehiclePage from '@/industries/auto-body/pages/customer-vehicles/new/page'
import type { ComponentProps } from 'react'

export default async function Page(props: ComponentProps<typeof NewCustomerVehiclePage>) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewCustomerVehiclePage {...props} />
}
