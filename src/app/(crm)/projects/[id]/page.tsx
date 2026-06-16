import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import RealEstateProjectDetailPage from '@/industries/real-estate/pages/projects/[id]/page'
import { requireBookRead } from '@/lib/permissions'

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('projects')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstateProjectDetailPage params={props.params} />
}
