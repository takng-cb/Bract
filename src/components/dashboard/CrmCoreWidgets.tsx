/**
 * crm-core モジュールの状況ボード（#4 / #105）。
 * 取引先・人物の件数＋最近更新レコードを表示。/modules/crm-core で使用。
 * widgetPrefs（scope='module:crm-core'）でウィジェットの表示/非表示・並びを制御できる。
 */
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { ne, count, desc } from 'drizzle-orm'
import { Building2, Users } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import type { DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { sortedVisibleModuleWidgets } from '@/lib/dashboard/moduleWidgets'

export default async function CrmCoreWidgets({ widgetPrefs }: { widgetPrefs?: DashboardWidgetPrefs | null }) {
  const visible = sortedVisibleModuleWidgets('crm-core', widgetPrefs)
  if (visible.length === 0) return null

  const [accCount, conCount, recentAccounts, recentContacts] = await Promise.all([
    db.select({ c: count() }).from(accounts).where(ne(accounts.status, 'inactive')),
    db.select({ c: count() }).from(contacts),
    db.select({ id: accounts.id, name: accounts.name, industry: accounts.industry, updated_at: accounts.updated_at }).from(accounts).orderBy(desc(accounts.updated_at)).limit(5),
    db.select({ id: contacts.id, full_name: contacts.full_name, title: contacts.title, updated_at: contacts.updated_at }).from(contacts).orderBy(desc(contacts.updated_at)).limit(5),
  ])

  const recent = [
    ...recentAccounts.map((r) => ({ type: '取引先', icon: '🏢', href: `/accounts/${r.id}`, title: r.name, sub: r.industry ?? '', at: r.updated_at })),
    ...recentContacts.map((r) => ({ type: '人物', icon: '👤', href: `/contacts/${r.id}`, title: r.full_name, sub: r.title ?? '', at: r.updated_at })),
  ].sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime()).slice(0, 8)

  // ウィジェット id → セクション（moduleWidgets.ts の定義と対）
  const sections: Record<string, ReactNode> = {
    'crm-core-counts': (
      <div className="grid grid-cols-2 gap-4">
        <Link href="/accounts" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-brand-50 text-brand-700 shrink-0"><Building2 className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">取引先</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(accCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">社</span></p>
        </Link>
        <Link href="/contacts" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-brand-50 text-brand-700 shrink-0"><Users className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">人物</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(conCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">名</span></p>
        </Link>
      </div>
    ),
    'crm-core-recent-records': (
      <div>
        <h2 className="font-semibold text-zinc-800 mb-3">最近更新されたレコード</h2>
        {recent.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">なし</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {recent.map((r, i) => (
              <Link key={i} href={r.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 shrink-0"><NavIcon icon={r.icon} className="w-3.5 h-3.5 shrink-0" />{r.type}</span>
                <span className="flex-1 min-w-0"><span className="block text-sm text-zinc-900 truncate">{r.title}</span>{r.sub && <span className="block text-xs text-zinc-400 truncate">{r.sub}</span>}</span>
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
