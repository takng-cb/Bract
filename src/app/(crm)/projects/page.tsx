import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import RealEstateProjectsPage from '@/industries/real-estate/pages/projects/page'
import { requireBookRead } from '@/lib/permissions'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; sort?: string }>
}) {
  await requireBookRead('projects')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstateProjectsPage searchParams={searchParams} />
}
