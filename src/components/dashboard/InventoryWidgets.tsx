/**
 * inventory モジュールの状況ボード（#4 / #105）。
 * 商品・倉庫の件数＋最近の入出庫を表示。/modules/inventory で使用。
 * widgetPrefs（scope='module:inventory'）でウィジェットの表示/非表示・並びを制御できる。
 */
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { products, warehouses, stock_movements } from '@/lib/schema'
import { eq, count, desc } from 'drizzle-orm'
import { Package, Warehouse } from 'lucide-react'
import type { DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { sortedVisibleModuleWidgets } from '@/lib/dashboard/moduleWidgets'

export default async function InventoryWidgets({ widgetPrefs }: { widgetPrefs?: DashboardWidgetPrefs | null }) {
  const visible = sortedVisibleModuleWidgets('inventory', widgetPrefs)
  if (visible.length === 0) return null

  const [prodCount, whCount, recentMoves] = await Promise.all([
    db.select({ c: count() }).from(products),
    db.select({ c: count() }).from(warehouses),
    db.select({ id: stock_movements.id, type: stock_movements.movement_type, qty: stock_movements.quantity, occurred_at: stock_movements.occurred_at, product: products.name })
      .from(stock_movements)
      .leftJoin(products, eq(stock_movements.product_id, products.id))
      .orderBy(desc(stock_movements.occurred_at), desc(stock_movements.created_at)).limit(12),
  ])

  // ウィジェット id → セクション（moduleWidgets.ts の定義と対）
  const sections: Record<string, ReactNode> = {
    'inventory-counts': (
      <div className="grid grid-cols-2 gap-4">
        <Link href="/products" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-brand-50 text-brand-700 shrink-0"><Package className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">商品</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(prodCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">点</span></p>
        </Link>
        <Link href="/warehouses" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-brand-50 text-brand-700 shrink-0"><Warehouse className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">倉庫</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(whCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">拠点</span></p>
        </Link>
      </div>
    ),
    'inventory-recent-movements': (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800">最近の入出庫</h2>
          <Link href="/stock-movements" className="text-xs text-blue-600 hover:text-blue-800">在庫移動 →</Link>
        </div>
        {recentMoves.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">入出庫の記録はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {recentMoves.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="shrink-0 text-xs text-zinc-500 tabular-nums w-24">{m.occurred_at}</span>
                <span className="flex-1 min-w-0 text-sm text-zinc-900 truncate">{m.product ?? '—'}</span>
                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${m.type === '入庫' ? 'bg-positive-bg text-positive' : m.type === '出庫' ? 'bg-danger-bg text-danger' : 'bg-zinc-100 text-zinc-600'}`}>{m.type}</span>
                <span className="shrink-0 text-xs text-zinc-600 tabular-nums">{m.qty}</span>
              </div>
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
