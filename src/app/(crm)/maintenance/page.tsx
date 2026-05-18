import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import MaintenanceListPage from '@/industries/auto-body/pages/maintenance/page'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  if (activeIndustry !== 'auto-body') notFound()
  return <MaintenanceListPage searchParams={searchParams} />
}
