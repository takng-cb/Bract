/**
 * Properties 新規作成 — INDUSTRY 切替の proxy
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstateNewPropertyPage from '@/industries/real-estate/pages/properties/new/page'
import { requireBookRead } from '@/lib/permissions'

export default async function NewPropertyPage(
  props: ComponentProps<typeof RealEstateNewPropertyPage>,
) {
  await requireBookRead('properties')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstateNewPropertyPage {...props} />
}
