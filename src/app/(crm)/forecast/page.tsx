import { db } from '@/lib/db'
import { opportunities, expenses, accounts } from '@/lib/schema'
import { eq, asc, ne } from 'drizzle-orm'
import Link from 'next/link'
import PeriodSelector from '@/components/PeriodSelector'
import { activeIndustry } from '@/lib/industry'
import { calcProfit } from '@/industries/real-estate/lib/realEstateCommission'
import { getAllUsers } from '@/lib/userUtils'
import { formatDateLocal, lastOfMonth, firstOfMonth } from '@/lib/dateUtils'
import {
  ForecastTimeSeriesChart,
  ForecastStageStackedChart,
  ForecastOwnerBarChart,
  type TimeBucket,
  type StageBucket,
  type OwnerBucket,
} from '@/components/ForecastCharts'

const STAGE_LABELS: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'text-zinc-500', qualification: 'text-blue-600',
  proposal: 'text-yellow-600', negotiation: 'text-orange-600',
  closed_won: 'text-green-600', closed_lost: 'text-red-500',
}

/** 日数差から週/月集計を選ぶ。≤62日なら週、それ以上なら月。 */
function pickGranularity(from: string, to: string): 'week' | 'month' {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24) + 1
  return days <= 62 ? 'week' : 'month'
}

/** YYYY-MM-DD を granularity に応じたキー (例: '2026-05', '2026-W19') に変換 */
function bucketKey(date: string, granularity: 'week' | 'month'): string {
  const d = new Date(date)
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  // ISO 週番号（簡易）
  const target = new Date(d)
  const dayNum = (target.getDay() + 6) % 7  // Mon=0
  target.setDate(target.getDate() - dayNum + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3)
  const week = Math.ceil(((target.getTime() - firstThursday.getTime()) / 86_400_000 + 1) / 7) + 1
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** from-to の範囲を granularity 単位で全 bucket 列挙（データなしバケットも 0 で出すため） */
function enumerateBuckets(from: string, to: string, granularity: 'week' | 'month'): string[] {
  const result: string[] = []
  const start = new Date(from)
  const end   = new Date(to)
  if (granularity === 'month') {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    const cur = new Date(start)
    while (cur <= end) {
      result.push(bucketKey(formatDateLocal(cur), 'week'))
      cur.setDate(cur.getDate() + 7)
    }
    // 重複除去（同週開始日が複数の場合）
    return Array.from(new Set(result))
  }
  return result
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
    from = firstOfMonth(year, month)
    to   = lastOfMonth(year, month)
  }

  const isReal = activeIndustry === 'real-estate'

  const [allOpps, allExpenses, users] = await Promise.all([
    db.select({
      id: opportunities.id, name: opportunities.name, stage: opportunities.stage,
      amount: opportunities.amount, probability: opportunities.probability,
      close_date: opportunities.close_date, owner_id: opportunities.owner_id,
      commission_fee: opportunities.commission_fee,
      brokerage_type: opportunities.brokerage_type,
      other_profit: opportunities.other_profit,
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
    getAllUsers(),
  ])

  // 期間フィルタ（JS側）
  const opps = allOpps.filter((o) => o.close_date && o.close_date >= from && o.close_date <= to)
  const exps = allExpenses.filter((e) => e.expense_date && e.expense_date >= from && e.expense_date <= to)

  /**
   * 1商談の「売上ベース額」を返す。
   * - real-estate モード: 仲介手数料を multiplier で乗算 + その他利益（calcProfit）
   * - base モード:        商談金額
   */
  const baseRevenueOf = (o: typeof opps[number]) => {
    if (!isReal) return Number(o.amount ?? 0)
    const fee = o.commission_fee != null ? Number(o.commission_fee) : null
    const oth = o.other_profit != null ? Number(o.other_profit) : 0
    return fee != null ? calcProfit(fee, o.brokerage_type, oth) : 0
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

  // ── チャート用集計 ─────────────────────────────────────
  const granularity = pickGranularity(from, to)
  const buckets     = enumerateBuckets(from, to, granularity)

  // 時系列: 想定売上 vs 受注済
  const timeSeriesMap = new Map<string, { weighted: number; closedWon: number }>()
  for (const b of buckets) timeSeriesMap.set(b, { weighted: 0, closedWon: 0 })
  for (const o of opps) {
    if (!o.close_date) continue
    const key = bucketKey(o.close_date, granularity)
    const cur = timeSeriesMap.get(key) ?? { weighted: 0, closedWon: 0 }
    const base = baseRevenueOf(o)
    const prob = o.probability != null ? o.probability / 100 : 1
    cur.weighted += base * prob
    if (o.stage === 'closed_won') cur.closedWon += base
    timeSeriesMap.set(key, cur)
  }
  const timeSeriesData: TimeBucket[] = buckets.map((label) => ({
    label,
    weighted: Math.round(timeSeriesMap.get(label)?.weighted ?? 0),
    closedWon: Math.round(timeSeriesMap.get(label)?.closedWon ?? 0),
  }))

  // ステージ別 積み上げ
  const stageMap = new Map<string, StageBucket>()
  for (const b of buckets) {
    stageMap.set(b, { label: b, prospecting: 0, qualification: 0, proposal: 0, negotiation: 0, closed_won: 0 })
  }
  for (const o of opps) {
    if (!o.close_date) continue
    const key = bucketKey(o.close_date, granularity)
    const bucket = stageMap.get(key)
    if (!bucket) continue
    const base = baseRevenueOf(o)
    const prob = o.probability != null ? o.probability / 100 : 1
    const weighted = base * prob
    const stageKey = o.stage as keyof Omit<StageBucket, 'label'>
    if (stageKey in bucket) {
      bucket[stageKey] += weighted
    }
  }
  const stageData: StageBucket[] = buckets.map((b) => {
    const v = stageMap.get(b)!
    return {
      label: b,
      prospecting:   Math.round(v.prospecting),
      qualification: Math.round(v.qualification),
      proposal:      Math.round(v.proposal),
      negotiation:   Math.round(v.negotiation),
      closed_won:    Math.round(v.closed_won),
    }
  })

  // 担当者別集計
  const userNameMap = new Map(users.map((u) => [u.id, u.name]))
  type OwnerAgg = { weighted: number; closedWon: number; count: number }
  const ownerMap = new Map<string, OwnerAgg>()
  for (const o of opps) {
    const ownerName = o.owner_id ? (userNameMap.get(o.owner_id) ?? '未設定') : '未設定'
    const cur = ownerMap.get(ownerName) ?? { weighted: 0, closedWon: 0, count: 0 }
    const base = baseRevenueOf(o)
    const prob = o.probability != null ? o.probability / 100 : 1
    cur.weighted += base * prob
    if (o.stage === 'closed_won') cur.closedWon += base
    cur.count += 1
    ownerMap.set(ownerName, cur)
  }
  const ownerRows = Array.from(ownerMap.entries())
    .map(([ownerName, agg]) => ({
      ownerName,
      count: agg.count,
      weighted: Math.round(agg.weighted),
      closedWon: Math.round(agg.closedWon),
    }))
    .sort((a, b) => b.weighted - a.weighted)
  const ownerChartData: OwnerBucket[] = ownerRows.map((r) => ({
    ownerName: r.ownerName,
    weighted: r.weighted,
    count: r.count,
  }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">売上予測</h1>
          <p className="text-sm text-zinc-500 mt-1">{from} 〜 {to} の商談・経費サマリー（{granularity === 'month' ? '月別' : '週別'}集計）</p>
        </div>
        <PeriodSelector from={from} to={to} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: '想定売上', value: `¥${Math.round(weightedRevenue).toLocaleString()}`, sub: isReal ? '確度 × 利益' : '確度 × 金額', color: 'text-blue-600' },
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

      {/* チャート: 時系列 + ステージ別積み上げ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">想定売上・受注済 推移</h2>
          <ForecastTimeSeriesChart data={timeSeriesData} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">ステージ別 積み上げ（想定売上）</h2>
          <ForecastStageStackedChart data={stageData} />
        </div>
      </div>

      {/* 担当者別 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-8">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">担当者別サマリー</h2>
        {ownerRows.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">期間内のデータがありません</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-zinc-600">担当者</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">商談</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">想定売上</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">受注済</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ownerRows.map((r) => (
                    <tr key={r.ownerName} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-800">{r.ownerName}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">{r.count}</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-700">¥{r.weighted.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-green-700">¥{r.closedWon.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <ForecastOwnerBarChart data={ownerChartData} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* 商談一覧 */}
        <div className="md:col-span-3">
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
                    <th className="text-right px-3 py-2 font-medium text-zinc-600">{isReal ? '利益' : '金額'}</th>
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
        <div className="md:col-span-2">
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
