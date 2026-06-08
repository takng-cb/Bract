import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import CustomerVehiclesListPage from '@/industries/auto-body/pages/customer-vehicles/page'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <CustomerVehiclesListPage searchParams={searchParams} />
}
