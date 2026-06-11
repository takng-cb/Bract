/**
 * Properties 詳細 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstatePropertyDetailPage from '@/industries/real-estate/pages/properties/[id]/page'
import { requireBookRead } from '@/lib/permissions'

export default async function PropertyDetailPage(
  props: ComponentProps<typeof RealEstatePropertyDetailPage>,
) {
  await requireBookRead('properties')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstatePropertyDetailPage {...props} />
}
