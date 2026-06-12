import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'
import { requireApiUser } from '@/lib/apiAuth'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

export async function GET(request: Request) {
  // 認証確認（未ログインは 401）
  const denied = await requireApiUser()
  if (denied) return denied

  // エクスポートのフィルタ指定（REQ-0052）: 一覧と同じ f パラメータ
  const filterRaw = new URL(request.url).searchParams.getAll('f')
  const conditions = parseFilterParams(filterRaw)

  try {
    const data = await db.select({
      id:             accounts.id,
      name:           accounts.name,
      type:           accounts.type,
      industry:       accounts.industry,
      phone:          accounts.phone,
      website:        accounts.website,
      address:        accounts.address,
      annual_revenue: accounts.annual_revenue,
      employee_count: accounts.employee_count,
      status:         accounts.status,
      description:    accounts.description,
      created_at:     accounts.created_at,
    }).from(accounts).orderBy(desc(accounts.created_at))

    const filtered = conditions.length > 0
      ? (applyFilters(data as unknown as Record<string, unknown>[], conditions) as unknown as typeof data)
      : data

    const headers = ['ID', '会社名', '種別', '業種', '電話番号', 'Webサイト', '住所', '年間売上', '従業員数', 'ステータス', 'メモ', '登録日']
    const rows = filtered.map((r) => [
      r.id,
      r.name,
      r.type ?? '',
      r.industry ?? '',
      r.phone ?? '',
      r.website ?? '',
      r.address ?? '',
      r.annual_revenue ?? '',
      r.employee_count ?? '',
      r.status,
      r.description ?? '',
      r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="accounts.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
