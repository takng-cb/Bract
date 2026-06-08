/**
 * Properties 詳細 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstatePropertyDetailPage from '@/industries/real-estate/pages/properties/[id]/page'

export default async function PropertyDetailPage(
  props: ComponentProps<typeof RealEstatePropertyDetailPage>,
) {
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstatePropertyDetailPage {...props} />
}
