import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyPartDetail from '@/industries/auto-body/pages/parts/[id]/page'
import { requireBookRead } from '@/lib/permissions'

export default async function PartDetailPage(props: { params: Promise<{ id: string }> }) {
  await requireBookRead('parts')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyPartDetail params={props.params} />
}
