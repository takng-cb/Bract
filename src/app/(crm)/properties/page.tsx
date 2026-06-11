/**
 * Properties 一覧 — INDUSTRY 切替の proxy
 *
 * INDUSTRY=real-estate のときだけ overlay の専用ページを描画。
 * その他の業種では notFound()（next.config.ts のリダイレクトに任せる前提）。
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import RealEstatePropertiesPage from '@/industries/real-estate/pages/properties/page'
import { requireBookRead } from '@/lib/permissions'

export default async function PropertiesPage(
  props: ComponentProps<typeof RealEstatePropertiesPage>,
) {
  await requireBookRead('properties')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <RealEstatePropertiesPage {...props} />
}
