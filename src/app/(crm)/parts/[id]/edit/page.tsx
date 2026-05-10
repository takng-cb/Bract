import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import EditAutoBodyPartPage from '@/industries/auto-body/pages/parts/[id]/edit/page'

export default async function EditPartPage(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <EditAutoBodyPartPage params={props.params} />
}
