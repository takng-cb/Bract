import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyPartsPage from '@/industries/auto-body/pages/parts/page'

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyPartsPage searchParams={searchParams} />
}
