import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import NewTemplatePage from '@/industries/auto-body/pages/maintenance/templates/new/page'

export default async function Page() {
  if (activeIndustry !== 'auto-body') notFound()
  return <NewTemplatePage />
}
