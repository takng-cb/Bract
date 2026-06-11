import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewAutoBodyPartPage from '@/industries/auto-body/pages/parts/new/page'
import { requireBookRead } from '@/lib/permissions'

export default async function NewPartPage() {
  await requireBookRead('parts')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewAutoBodyPartPage />
}
