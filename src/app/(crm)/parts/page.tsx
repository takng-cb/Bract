import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import AutoBodyPartsPage from '@/industries/auto-body/pages/parts/page'

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  if (activeIndustry !== 'auto-body') notFound()
  return <AutoBodyPartsPage searchParams={searchParams} />
}
