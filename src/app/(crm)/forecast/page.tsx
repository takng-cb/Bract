import { db } from '@/lib/db'
import { opportunities, expenses, accounts } from '@/lib/schema'
import { eq, asc, ne } from 'drizzle-orm'
import Link from 'next/link'
import PeriodSelector from '@/components/PeriodSelector'
import { activeIndustry } from '@/lib/industry'
import { calcProfit } from '@/industries/real-estate/lib/realEstateCommission'
import { calcAutoBodyProfit } from '@/industries/auto-body/lib/autoBodyService'

const STAGE_LABELS: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'text-zinc-500', qualification: 'text-blue-600',
  proposal: 'text-yellow-600', negotiation: 'text-orange-600',
  closed_won: 'text-green-600', closed_lost: 'text-red-500',
}

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; year?: string; month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()

  // from/to を優先、なければ year/month（後方互換）、それもなければ今月
  let from: string
  let to:   string
  if (sp.from && sp.to) {
    from = sp.from
    to   = sp.to
  } else {
    const year  = Number(sp.year  ?? now.getFullYear())
    const month = Number(sp.month ?? now.getMonth() + 1)
    from = `${year}-${String(month).padStart(2, '0')}-01`
    to   = new Date(year, month, 0).toISOString().slice(0, 10)
  }

  const isReal     = activeIndustry === 'real-estate'
  const isAutoBody = activeIndustry === 'auto-body'

  const [allOpps, allExpenses] = await Promise.all([
    db.select({
      id: opportunities.id, name: opportunities.name, stage: opportunities.stage,
      amount: opportunities.amount, probability: opportunities.probability,
      close_date: opportunities.close_date,
      commission_fee: opportunities.commission_fee,
      brokerage_type: opportunities.brokerage_type,
      other_profit: opportunities.other_profit,
      parts_cost: opportunities.parts_cost,
      accounts: { name: accounts.name },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .where(ne(opportunities.stage, 'closed_lost'))
      .orderBy(asc(opportunities.close_date)),
    db.select({
      id: expenses.id, title: expenses.title, amount: expenses.amount,
      category: expenses.category, expense_date: expenses.expense_date,
    })
      .from(expenses)
      .orderBy(asc(expenses.expense_date)),
  ])

  // 期間フィルタ（JS側）
  const opps = allOpps.filter((o) => o.close_date && o.close_date >= from && o.close_date <= to)
  const exps = allExpenses.filter((e) => e.expense_date && e.expense_date >= from && e.expense_date <= to)

  /**
   * 1商談の「売上ベース額」を返す。
   * - real-estate モード: 仲介手数料を multiplier で乗算 + その他利益（calcProfit）
   * - auto-body モード:   利益 = amount − parts_cost
   * - base モード:        商談金額
   */
  const baseRevenueOf = (o: typeof opps[number]) => {
    if (isReal) {
      const fee = o.commission_fee != null ? Number(o.commission_fee) : null
      const oth = o.other_profit != null ? Number(o.other_profit) : 0
      return fee != null ? calcProfit(fee, o.brokerage_type, oth) : 0
    }
    if (isAutoBody) {
      const amt = Number(o.amount ?? 0)
      const pc  = o.parts_cost != null ? Number(o.parts_cost) : 0
      return calcAutoBodyProfit(amt, pc)
    }
    return Number(o.amount ?? 0)
  }

  const weightedRevenue = opps.reduce((sum, o) => {
    const base = baseRevenueOf(o)
    const prob = o.probability != null ? o.probability / 100 : 1
    return sum + base * prob
  }, 0)

  const actualClosedWon = opps
    .filter((o) => o.stage === 'closed_won')
    .reduce((s, o) => s + baseRevenueOf(o), 0)

  const totalExpenses = exps.reduce((s, e) => s + Number(e.amount), 0)
  const grossProfit   = weightedRevenue - totalExpenses

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">売上予測</h1>
          <p className="text-sm text-zinc-500 mt-1">{from} 〜 {to} の商談・経費サマリー</p>
        </div>
        <PeriodSelector from={from} to={to} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '想定売上', value: `¥${Math.round(weightedRevenue).toLocaleString()}`, sub: (isReal || isAutoBody) ? '確度 × 利益' : '確度 × 金額', color: 'text-blue-600' },
          { label: '受注済', value: `¥${Math.round(actualClosedWon).toLocaleString()}`, sub: `${opps.filter(o => o.stage === 'closed_won').length} 件`, color: 'text-green-600' },
          { label: '経費合計', value: `¥${totalExpenses.toLocaleString()}`, sub: `${exps.length} 件`, color: 'text-orange-600' },
          { label: '想定粗利', value: `¥${Math.round(grossProfit).toLocaleString()}`, sub: '想定売上 − 経費', color: grossProfit >= 0 ? 'text-green-700' : 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs text-zinc-400 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* 商談一覧 */}
        <div className="col-span-3">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">
            対象商談 <span className="text-zinc-400 font-normal">({opps.length} 件)</span>
          </h2>
          {opps.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">
              この期間に完了予定の商談がありません
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-zinc-600">商談名</th>
                    <th className="text-left px-3 py-2 font-medium text-zinc-600">ステージ</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">{(isReal || isAutoBody) ? '利益' : '金額'}</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">確度</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">想定売上</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {opps.map((o) => {
                    const base     = baseRevenueOf(o)
                    const prob     = o.probability != null ? o.probability / 100 : 1
                    const weighted = base * prob
                    const account  = o.accounts?.name ? o.accounts : null
                    return (
                      <tr key={o.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2">
                          <Link href={`/opportunities/${o.id}`} className="font-medium hover:text-blue-600 block">{o.name}</Link>
                          {account && <span className="text-xs text-zinc-400">{account.name}</span>}
                        </td>
                        <td className={`px-3 py-2 text-xs font-medium ${STAGE_COLORS[o.stage] ?? ''}`}>
                          {STAGE_LABELS[o.stage] ?? o.stage}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-700">
                          {base > 0 ? `¥${Math.round(base).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500">
                          {o.probability != null ? `${o.probability}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-blue-700">
                          ¥{Math.round(weighted).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-zinc-600">想定売上合計</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700">
                      ¥{Math.round(weightedRevenue).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* 経費一覧 */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-700">
              経費 <span className="text-zinc-400 font-normal">({exps.length} 件)</span>
            </h2>
            <Link href={`/expenses?from=${from}&to=${to}`} className="text-xs text-blue-600 hover:text-blue-800">詳細</Link>
          </div>
          {exps.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">
              この期間の経費がありません
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                {exps.map((e) => (
                  <div key={e.id} className="px-3 py-2 flex items-center justify-between hover:bg-zinc-50">
                    <div className="min-w-0">
                      <Link href={`/expenses/${e.id}`} className="text-xs font-medium text-zinc-800 hover:text-blue-600 truncate block">{e.title}</Link>
                      <span className="text-xs text-zinc-400">{e.category}</span>
                    </div>
                    <span className="text-xs font-medium text-zinc-700 shrink-0 ml-2">
                      ¥{Number(e.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t-2 border-zinc-200 bg-zinc-50 px-3 py-2 flex justify-between">
                <span className="text-xs font-semibold text-zinc-600">合計</span>
                <span className="text-xs font-bold text-orange-700">¥{totalExpenses.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
