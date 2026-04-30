import { db } from '@/lib/db'
import { opportunities, accounts } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

const STAGE_LABEL: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

export async function GET() {
  try {
    const data = await db.select({
      name:        opportunities.name,
      stage:       opportunities.stage,
      amount:      opportunities.amount,
      close_date:  opportunities.close_date,
      probability: opportunities.probability,
      description: opportunities.description,
      created_at:  opportunities.created_at,
      accounts:    { name: accounts.name },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .orderBy(desc(opportunities.created_at))

    const headers = ['商談名', 'ステージ', '金額', '完了予定日', '確度(%)', '取引先', 'メモ', '登録日']
    const rows = data.map((r) => {
      const accountName = r.accounts?.name ?? ''
      return [
        r.name,
        STAGE_LABEL[r.stage] ?? r.stage,
        r.amount ?? '',
        r.close_date ? new Date(r.close_date).toLocaleDateString('ja-JP') : '',
        r.probability ?? '',
        accountName,
        r.description ?? '',
        r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '',
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
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
