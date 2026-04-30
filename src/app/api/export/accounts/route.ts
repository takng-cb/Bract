import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('accounts')
    .select('name, type, industry, phone, website, address, annual_revenue, employee_count, status, description, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['会社名', '種別', '業種', '電話番号', 'Webサイト', '住所', '年間売上', '従業員数', 'ステータス', 'メモ', '登録日']
  const rows = (data ?? []).map((r) => [
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
    new Date(r.created_at).toLocaleDateString('ja-JP'),
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
}
