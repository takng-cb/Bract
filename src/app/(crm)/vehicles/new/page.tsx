import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewAutoBodyVehiclePage from '@/industries/auto-body/pages/vehicles/new/page'
import { requireBookRead } from '@/lib/permissions'

export default async function NewVehiclePage() {
  await requireBookRead('vehicles')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewAutoBodyVehiclePage />
}
