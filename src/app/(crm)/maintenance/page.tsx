import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import MaintenanceListPage from '@/industries/auto-body/pages/maintenance/page'
import { requireBookRead } from '@/lib/permissions'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; group?: string }>
}) {
  await requireBookRead('maintenance_records')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <MaintenanceListPage searchParams={searchParams} />
}
