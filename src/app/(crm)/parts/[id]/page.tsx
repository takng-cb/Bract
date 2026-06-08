import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyPartDetail from '@/industries/auto-body/pages/parts/[id]/page'

export default async function PartDetailPage(props: { params: Promise<{ id: string }> }) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyPartDetail params={props.params} />
}
