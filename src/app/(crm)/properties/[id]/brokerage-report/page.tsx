/**
 * 媒介契約報告書 — INDUSTRY 切替の proxy (Issue #1)
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import type { ComponentProps } from 'react'
import BrokerageReportPage from '@/industries/real-estate/pages/properties/[id]/brokerage-report/page'
import { requireBookRead } from '@/lib/permissions'

export default async function PropertyBrokerageReportPage(
  props: ComponentProps<typeof BrokerageReportPage>,
) {
  await requireBookRead('properties')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('real-estate'))) notFound()
  return <BrokerageReportPage {...props} />
}
