/**
 * real-estate モジュールの状況ボード（#4 / #105）。
 * 物件の総数・募集中件数＋最近更新の物件を表示。/modules/real-estate で使用。
 */
import Link from 'next/link'
import { db } from '@/lib/db'
import { properties } from '@/industries/real-estate/schema'
import { eq, count, desc } from 'drizzle-orm'
import { House } from 'lucide-react'

export default async function RealEstateWidgets() {
  const [totalRows, openRows, recent] = await Promise.all([
    db.select({ c: count() }).from(properties),
    db.select({ c: count() }).from(properties).where(eq(properties.status, '募集中')),
    db.select({ id: properties.id, name: properties.name, status: properties.status, price: properties.price, updated_at: properties.updated_at })
      .from(properties).orderBy(desc(properties.updated_at)).limit(8),
  ])

  return (
    <section className="mb-8 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Link href="/properties" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-brand-50 text-brand-700 shrink-0"><House className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">物件</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(totalRows[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">件</span></p>
        </Link>
        <Link href="/properties?f=status%3Deq%3A%E5%8B%9F%E9%9B%86%E4%B8%AD" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-info-bg text-info shrink-0"><House className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">募集中</p></div>
          <p className="text-3xl font-bold tabular-nums text-blue-600">{Number(openRows[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">件</span></p>
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800">最近更新された物件</h2>
          <Link href="/properties" className="text-xs text-blue-600 hover:text-blue-800">物件一覧 →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">物件がありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {recent.map((p) => (
              <Link key={p.id} href={`/properties/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50">
                <span className="flex-1 min-w-0 text-sm text-zinc-900 truncate">{p.name}</span>
                {p.status && <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{p.status}</span>}
                {p.price != null && <span className="shrink-0 text-xs text-zinc-500 tabular-nums">¥{Number(p.price).toLocaleString()}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
