import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import NewAutoBodyPartPage from '@/industries/auto-body/pages/parts/new/page'

export default async function NewPartPage() {
  if (activeIndustry !== 'auto-body') notFound()
  return <NewAutoBodyPartPage />
}
