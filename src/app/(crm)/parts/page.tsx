import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import AutoBodyPartsPage from '@/industries/auto-body/pages/parts/page'

export default async function PartsPage() {
  if (activeIndustry !== 'auto-body') notFound()
  return <AutoBodyPartsPage />
}
