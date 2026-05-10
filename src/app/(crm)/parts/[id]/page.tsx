import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import AutoBodyPartDetail from '@/industries/auto-body/pages/parts/[id]/page'

export default async function PartDetailPage(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <AutoBodyPartDetail params={props.params} />
}
