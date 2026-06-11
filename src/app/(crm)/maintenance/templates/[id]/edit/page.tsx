import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditTemplatePage from '@/industries/auto-body/pages/maintenance/templates/[id]/edit/page'
import { requireBookRead } from '@/lib/permissions'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('maintenance_records')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditTemplatePage params={props.params} />
}
