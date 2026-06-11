import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyVehicleDetail from '@/industries/auto-body/pages/vehicles/[id]/page'
import { requireBookRead } from '@/lib/permissions'

export default async function VehicleDetailPage(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('vehicles')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyVehicleDetail params={props.params} />
}
