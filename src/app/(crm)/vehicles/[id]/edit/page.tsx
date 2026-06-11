import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditAutoBodyVehiclePage from '@/industries/auto-body/pages/vehicles/[id]/edit/page'
import { requireBookRead } from '@/lib/permissions'

export default async function EditVehiclePage(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('vehicles')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditAutoBodyVehiclePage params={props.params} />
}
