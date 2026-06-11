/**
 * Properties 編集 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstateEditPropertyPage from '@/industries/real-estate/pages/properties/[id]/edit/page'
import { requireBookRead } from '@/lib/permissions'

export default async function EditPropertyPage(
  props: ComponentProps<typeof RealEstateEditPropertyPage>,
) {
  await requireBookRead('properties')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstateEditPropertyPage {...props} />
}
