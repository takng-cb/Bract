import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('contacts')
    .select('full_name, title, department, email, phone, birthday, description, created_at, accounts(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['氏名', '役職', '部署', 'メール', '電話番号', '誕生日', '取引先', 'メモ', '登録日']
  const rows = (data ?? []).map((r) => {
    const account = r.accounts as unknown as { name: string } | null
    return [
      r.full_name,
      r.title ?? '',
      r.department ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.birthday ? new Date(r.birthday).toLocaleDateString('ja-JP') : '',
      account?.name ?? '',
      r.description ?? '',
      new Date(r.created_at).toLocaleDateString('ja-JP'),
    ]
  })

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
    },
  })
}
