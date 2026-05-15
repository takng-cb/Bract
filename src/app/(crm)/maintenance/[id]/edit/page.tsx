import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import EditMaintenancePage from '@/industries/auto-body/pages/maintenance/[id]/edit/page'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  if (activeIndustry !== 'auto-body') notFound()
  return <EditMaintenancePage params={props.params} />
}
