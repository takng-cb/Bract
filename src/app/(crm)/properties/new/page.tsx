/**
 * Properties 新規作成 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import type { ComponentProps } from 'react'
import RealEstateNewPropertyPage from '@/industries/real-estate/pages/properties/new/page'

export default async function NewPropertyPage(
  props: ComponentProps<typeof RealEstateNewPropertyPage>,
) {
  if (activeIndustry !== 'real-estate') notFound()
  return <RealEstateNewPropertyPage {...props} />
}
