/**
 * Properties 編集 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstateEditPropertyPage from '@/industries/real-estate/pages/properties/[id]/edit/page'

export default async function EditPropertyPage(
  props: ComponentProps<typeof RealEstateEditPropertyPage>,
) {
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstateEditPropertyPage {...props} />
}
