import { db } from '@/lib/db'
import { opportunities, accounts } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'
import { calcProfit } from '@/industries/real-estate/lib/realEstateCommission'
import { activeIndustry } from '@/lib/industry'
import { requireApiUser } from '@/lib/apiAuth'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

const STAGE_LABEL: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

export async function GET(request: Request) {
  // 認証確認（未ログインは 401）
  const denied = await requireApiUser()
  if (denied) return denied

  // エクスポートのフィルタ指定（REQ-0052）: 一覧と同じ f パラメータ
  const filterRaw = new URL(request.url).searchParams.getAll('f')
  const conditions = parseFilterParams(filterRaw)

  try {
    const data = await db.select({
      id:          opportunities.id,
      name:        opportunities.name,
      stage:       opportunities.stage,
      amount:      opportunities.amount,
      close_date:  opportunities.close_date,
      probability: opportunities.probability,
      description: opportunities.description,
      created_at:  opportunities.created_at,
      transaction_type: opportunities.transaction_type,
      commission_fee:  opportunities.commission_fee,
      brokerage_type:  opportunities.brokerage_type,
      other_profit:    opportunities.other_profit,
      accounts:    { name: accounts.name },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .orderBy(desc(opportunities.created_at))

    const filtered = conditions.length > 0
      ? (applyFilters(data as unknown as Record<string, unknown>[], conditions) as unknown as typeof data)
      : data

    const isReal = activeIndustry === 'real-estate'
    const baseHeaders = [
      'ID', '商談名', 'ステージ', '金額', '完了予定日', '確度(%)',
      '取引先名', '説明', '登録日',
    ]
    const realEstateHeaders = ['取引区分', '仲介手数料', '仲介種別', 'その他利益', '利益']
    const headers = isReal ? [...baseHeaders, ...realEstateHeaders] : baseHeaders
    const rows = filtered.map((r) => {
      const baseRow = [
        r.id,
        r.name,
        STAGE_LABEL[r.stage] ?? r.stage,
        r.amount ?? '',
        r.close_date ? new Date(r.close_date).toLocaleDateString('ja-JP') : '',
        r.probability ?? '',
        r.accounts?.name ?? '',
        r.description ?? '',
        r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '',
      ]
      if (!isReal) return baseRow
      const fee  = r.commission_fee != null ? Number(r.commission_fee) : null
      const oth  = r.other_profit != null ? Number(r.other_profit) : 0
      const profit = fee != null
        ? calcProfit(fee, r.brokerage_type, oth)
        : null
      return [
        ...baseRow,
        r.transaction_type ?? '',
        fee != null ? Math.round(fee) : '',
        r.brokerage_type ?? '',
        oth || '',
        profit != null ? Math.round(profit) : '',
      ]
    })

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="opportunities.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
