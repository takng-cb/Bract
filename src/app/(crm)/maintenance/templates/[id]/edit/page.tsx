import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import EditTemplatePage from '@/industries/auto-body/pages/maintenance/templates/[id]/edit/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <EditTemplatePage params={props.params} />
}
