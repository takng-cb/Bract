import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import CustomerVehiclesListPage from '@/industries/auto-body/pages/customer-vehicles/page'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  if (activeIndustry !== 'auto-body') notFound()
  return <CustomerVehiclesListPage searchParams={searchParams} />
}
