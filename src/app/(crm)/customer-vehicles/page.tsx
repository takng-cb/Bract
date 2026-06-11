import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import CustomerVehiclesListPage from '@/industries/auto-body/pages/customer-vehicles/page'
import { requireBookRead } from '@/lib/permissions'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  await requireBookRead('customer_vehicles')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <CustomerVehiclesListPage searchParams={searchParams} />
}
