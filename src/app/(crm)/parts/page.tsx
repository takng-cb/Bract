import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyPartsPage from '@/industries/auto-body/pages/parts/page'
import { requireBookRead } from '@/lib/permissions'

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  await requireBookRead('parts')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyPartsPage searchParams={searchParams} />
}
