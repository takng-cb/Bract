/**
 * Vehicles CSV export — INDUSTRY 切替の proxy
 *
 * INDUSTRY=auto-body のときだけ overlay 実装に委譲。
 */
import { NextResponse } from 'next/server'
import { activeIndustry } from '@/lib/industry'

export async function GET() {
  if (activeIndustry !== 'auto-body') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  const { GET: handler } = await import('@/industries/auto-body/api/export/vehicles/route')
  return handler()
}
