import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import NewCustomerVehiclePage from '@/industries/auto-body/pages/customer-vehicles/new/page'
import type { ComponentProps } from 'react'

export default async function Page(props: ComponentProps<typeof NewCustomerVehiclePage>) {
  if (activeIndustry !== 'auto-body') notFound()
  return <NewCustomerVehiclePage {...props} />
}
