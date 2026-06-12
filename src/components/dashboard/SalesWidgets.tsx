/**
 * sales モジュールの状況ボード（#4 / #105）。
 * 進行中商談の件数・今後30日にクローズ予定の商談リストを表示。/modules/sales で使用。
 * 金額予測は業種別計算（不動産の手数料/板金の整備合算）に依存するため、ここでは
 * 「件数」と「期限が近い商談」に絞り、詳細な金額予測は /forecast に委ねる。
 * widgetPrefs（scope='module:sales'）でウィジェットの表示/非表示・並びを制御できる。
 */
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { opportunities, accounts } from '@/lib/schema'
import { eq, and, notInArray, isNotNull, lte, gte, asc, count } from 'drizzle-orm'
import { TrendingUp } from 'lucide-react'
import { formatDateLocal, todayLocal } from '@/lib/dateUtils'
import type { DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { sortedVisibleModuleWidgets } from '@/lib/dashboard/moduleWidgets'

const STAGE_LABEL: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案', negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}
const CLOSED = ['closed_won', 'closed_lost']

export default async function SalesWidgets({ widgetPrefs }: { widgetPrefs?: DashboardWidgetPrefs | null }) {
  const visible = sortedVisibleModuleWidgets('sales', widgetPrefs)
  if (visible.length === 0) return null

  const today = todayLocal()
  const in30 = (() => { const d = new Date(today); d.setDate(d.getDate() + 30); return formatDateLocal(d) })()

  const [openCount, closing] = await Promise.all([
    db.select({ c: count() }).from(opportunities).where(notInArray(opportunities.stage, CLOSED)),
    db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage, close_date: opportunities.close_date, account: accounts.name })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .where(and(notInArray(opportunities.stage, CLOSED), isNotNull(opportunities.close_date), lte(opportunities.close_date, in30), gte(opportunities.close_date, today)))
      .orderBy(asc(opportunities.close_date)).limit(12),
  ])

  // ウィジェット id → セクション（moduleWidgets.ts の定義と対）
  const sections: Record<string, ReactNode> = {
    'sales-counts': (
      <div className="grid grid-cols-2 gap-4">
        <Link href="/opportunities" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-info-bg text-info shrink-0"><TrendingUp className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">進行中の商談</p></div>
          <p className="text-3xl font-bold tabular-nums text-blue-600">{Number(openCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">件</span></p>
        </Link>
        <Link href="/forecast" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-positive-bg text-positive shrink-0"><TrendingUp className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">30日内クローズ予定</p></div>
          <p className="text-3xl font-bold tabular-nums text-green-700">{closing.length.toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">件</span></p>
        </Link>
      </div>
    ),
    'sales-closing-soon': (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800">期限が近い商談<span className="ml-2 text-zinc-400 font-normal text-sm">（今後30日）</span></h2>
          <Link href="/forecast" className="text-xs text-blue-600 hover:text-blue-800">売上予測 →</Link>
        </div>
        {closing.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">今後30日にクローズ予定の商談はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {closing.map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50">
                <span className="flex-1 min-w-0"><span className="block text-sm text-zinc-900 truncate">{o.name}</span>{o.account && <span className="block text-xs text-zinc-400 truncate">{o.account}</span>}</span>
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{STAGE_LABEL[o.stage] ?? o.stage}</span>
                <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{o.close_date}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    ),
  }

  return (
    <section className="mb-8 space-y-6">
      {visible.map((w) => <Fragment key={w.id}>{sections[w.id]}</Fragment>)}
    </section>
  )
}
