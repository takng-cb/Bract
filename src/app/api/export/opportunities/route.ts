import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const STAGE_LABEL: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

export async function GET() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('name, stage, amount, close_date, probability, description, created_at, accounts(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['商談名', 'ステージ', '金額', '完了予定日', '確度(%)', '取引先', 'メモ', '登録日']
  const rows = (data ?? []).map((r) => {
    const account = r.accounts as unknown as { name: string } | null
    return [
      r.name,
      STAGE_LABEL[r.stage] ?? r.stage,
      r.amount ?? '',
      r.close_date ? new Date(r.close_date).toLocaleDateString('ja-JP') : '',
      r.probability ?? '',
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
      'Content-Disposition': 'attachment; filename="opportunities.csv"',
    },
  })
}
