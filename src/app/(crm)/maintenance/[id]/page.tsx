import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import MaintenanceDetailPage from '@/industries/auto-body/pages/maintenance/[id]/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <MaintenanceDetailPage params={props.params} />
}
