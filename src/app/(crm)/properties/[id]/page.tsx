/**
 * Properties 詳細 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import type { ComponentProps } from 'react'
import RealEstatePropertyDetailPage from '@/industries/real-estate/pages/properties/[id]/page'

export default async function PropertyDetailPage(
  props: ComponentProps<typeof RealEstatePropertyDetailPage>,
) {
  if (activeIndustry !== 'real-estate') notFound()
  return <RealEstatePropertyDetailPage {...props} />
}
