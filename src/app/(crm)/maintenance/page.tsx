import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import MaintenanceListPage from '@/industries/auto-body/pages/maintenance/page'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <MaintenanceListPage searchParams={searchParams} />
}
