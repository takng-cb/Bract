import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewTemplatePage from '@/industries/auto-body/pages/maintenance/templates/new/page'
import { requireBookRead } from '@/lib/permissions'

export default async function Page() {
  await requireBookRead('maintenance_records')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewTemplatePage />
}
