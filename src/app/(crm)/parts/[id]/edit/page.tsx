import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditAutoBodyPartPage from '@/industries/auto-body/pages/parts/[id]/edit/page'
import { requireBookRead } from '@/lib/permissions'

export default async function EditPartPage(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('parts')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <EditAutoBodyPartPage params={props.params} />
}
