/**
 * Properties CSV import — INDUSTRY 切替の proxy
 *
 * INDUSTRY=real-estate のときだけ overlay 実装に委譲。
 */
import { NextResponse, type NextRequest } from 'next/server'
import { activeIndustry } from '@/lib/industry'

export async function POST(req: NextRequest) {
  if (activeIndustry !== 'real-estate') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  const { POST: handler } = await import('@/industries/real-estate/api/import/properties/route')
  return handler(req)
}
