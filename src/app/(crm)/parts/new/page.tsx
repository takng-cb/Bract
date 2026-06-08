import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import NewAutoBodyPartPage from '@/industries/auto-body/pages/parts/new/page'

export default async function NewPartPage() {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <NewAutoBodyPartPage />
}
