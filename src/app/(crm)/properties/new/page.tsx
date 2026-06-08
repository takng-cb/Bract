/**
 * Properties 新規作成 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstateNewPropertyPage from '@/industries/real-estate/pages/properties/new/page'

export default async function NewPropertyPage(
  props: ComponentProps<typeof RealEstateNewPropertyPage>,
) {
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstateNewPropertyPage {...props} />
}
