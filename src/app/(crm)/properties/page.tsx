/**
 * Properties 一覧 — INDUSTRY 切替の proxy
 *
 * INDUSTRY=real-estate のときだけ overlay の専用ページを描画。
 * その他の業種では notFound()（next.config.ts のリダイレクトに任せる前提）。
 */
import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import type { ComponentProps } from 'react'
import RealEstatePropertiesPage from '@/industries/real-estate/pages/properties/page'

export default async function PropertiesPage(
  props: ComponentProps<typeof RealEstatePropertiesPage>,
) {
  if (activeIndustry !== 'real-estate') notFound()
  return <RealEstatePropertiesPage {...props} />
}
