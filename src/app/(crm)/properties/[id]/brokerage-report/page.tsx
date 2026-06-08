/**
 * 媒介契約報告書 — INDUSTRY 切替の proxy (Issue #1)
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import BrokerageReportPage from '@/industries/real-estate/pages/properties/[id]/brokerage-report/page'

export default async function PropertyBrokerageReportPage(
  props: ComponentProps<typeof BrokerageReportPage>,
) {
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <BrokerageReportPage {...props} />
}
