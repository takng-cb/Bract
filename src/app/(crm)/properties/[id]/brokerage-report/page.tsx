/**
 * 媒介契約報告書 — INDUSTRY 切替の proxy (Issue #1)
 */
import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import type { ComponentProps } from 'react'
import BrokerageReportPage from '@/industries/real-estate/pages/properties/[id]/brokerage-report/page'

export default async function PropertyBrokerageReportPage(
  props: ComponentProps<typeof BrokerageReportPage>,
) {
  if (activeIndustry !== 'real-estate') notFound()
  return <BrokerageReportPage {...props} />
}
