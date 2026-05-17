import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import TemplatesPage from '@/industries/auto-body/pages/maintenance/templates/page'

export default async function Page() {
  if (activeIndustry !== 'auto-body') notFound()
  return <TemplatesPage />
}
