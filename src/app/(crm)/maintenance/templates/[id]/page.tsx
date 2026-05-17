import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import TemplateDetailPage from '@/industries/auto-body/pages/maintenance/templates/[id]/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <TemplateDetailPage params={props.params} />
}
