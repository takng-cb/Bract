/**
 * Properties CSV export — INDUSTRY 切替の proxy
 *
 * INDUSTRY=real-estate のときだけ overlay 実装に委譲。
 */
import { NextResponse } from 'next/server'
import { activeIndustry } from '@/lib/industry'

export async function GET(request: Request) {
  if (activeIndustry !== 'real-estate') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  const { GET: handler } = await import('@/industries/real-estate/api/export/properties/route')
  return handler(request)
}
