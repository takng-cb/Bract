import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await db.select({
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

    const headers = ['会社名', '種別', '業種', '電話番号', 'Webサイト', '住所', '年間売上', '従業員数', 'ステータス', 'メモ', '登録日']
    const rows = data.map((r) => [
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

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="accounts.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
