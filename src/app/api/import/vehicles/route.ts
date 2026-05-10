/**
 * Vehicles CSV import — INDUSTRY 切替の proxy
 *
 * INDUSTRY=auto-body のときだけ overlay 実装に委譲。
 */
import { NextResponse, type NextRequest } from 'next/server'
import { activeIndustry } from '@/lib/industry'

export async function POST(req: NextRequest) {
  if (activeIndustry !== 'auto-body') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  const { POST: handler } = await import('@/industries/auto-body/api/import/vehicles/route')
  return handler(req)
}
