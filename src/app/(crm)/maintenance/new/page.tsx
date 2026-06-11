import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewMaintenancePage from '@/industries/auto-body/pages/maintenance/new/page'
import type { ComponentProps } from 'react'
import { requireBookRead } from '@/lib/permissions'

export default async function Page(props: ComponentProps<typeof NewMaintenancePage>) {
  await requireBookRead('maintenance_records')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewMaintenancePage {...props} />
}
