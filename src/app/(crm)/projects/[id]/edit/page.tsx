import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import EditRealEstateProjectPage from '@/industries/real-estate/pages/projects/[id]/edit/page'
import { requireBookRead } from '@/lib/permissions'

export default async function EditProjectPage(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('projects')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <EditRealEstateProjectPage params={props.params} />
}
