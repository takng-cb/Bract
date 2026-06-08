import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewMaintenancePage from '@/industries/auto-body/pages/maintenance/new/page'
import type { ComponentProps } from 'react'

export default async function Page(props: ComponentProps<typeof NewMaintenancePage>) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewMaintenancePage {...props} />
}
