import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import MaintenanceListPage from '@/industries/auto-body/pages/maintenance/page'

export default async function Page() {
  if (activeIndustry !== 'auto-body') notFound()
  return <MaintenanceListPage />
}
