/**
 * Vehicles 一覧 — INDUSTRY 切替の proxy
 *
 * INDUSTRY=auto-body のときだけ overlay の専用ページを描画。
 * その他の業種では notFound()（next.config.ts のリダイレクトに任せる前提）。
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import AutoBodyVehiclesPage from '@/industries/auto-body/pages/vehicles/page'

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string; sort?: string }>
}) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  return <AutoBodyVehiclesPage searchParams={searchParams} />
}
