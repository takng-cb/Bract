/**
 * staffing モジュールの状況ボード（#4 / #105）。
 * 案件総数・稼働中スタッフ数＋今後の業務日（直近の案件）を表示。/modules/staffing で使用。
 */
import Link from 'next/link'
import { db } from '@/lib/db'
import { assignments, staff, accounts } from '@/lib/schema'
import { eq, and, ne, count, asc, gte, isNotNull } from 'drizzle-orm'
import { Package, UserRound } from 'lucide-react'
import { todayLocal } from '@/lib/dateUtils'

export default async function StaffingWidgets() {
  const today = todayLocal()
  const [asgCount, staffCount, upcoming] = await Promise.all([
    db.select({ c: count() }).from(assignments),
    db.select({ c: count() }).from(staff).where(ne(staff.status, '引退')),
    db.select({ id: assignments.id, no: assignments.assignment_no, title: assignments.title, service_date: assignments.service_date, status: assignments.status, client: accounts.name })
      .from(assignments)
      .leftJoin(accounts, eq(assignments.client_account_id, accounts.id))
      .where(and(isNotNull(assignments.service_date), gte(assignments.service_date, today)))
      .orderBy(asc(assignments.service_date)).limit(12),
  ])

  return (
    <section className="mb-8 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Link href="/assignments" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-brand-50 text-brand-700 shrink-0"><Package className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">案件</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(asgCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">件</span></p>
        </Link>
        <Link href="/staff" className="bg-white border border-zinc-200 shadow-xs rounded-lg p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-2"><span className="grid place-items-center w-7 h-7 rounded-md bg-positive-bg text-positive shrink-0"><UserRound className="w-4 h-4" strokeWidth={2.25} /></span><p className="text-sm text-zinc-500">稼働中スタッフ</p></div>
          <p className="text-3xl font-bold tabular-nums text-zinc-800">{Number(staffCount[0]?.c ?? 0).toLocaleString()}<span className="text-sm font-normal text-zinc-500 ml-1">名</span></p>
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800">今後の業務日<span className="ml-2 text-zinc-400 font-normal text-sm">（直近の案件）</span></h2>
          <Link href="/assignments" className="text-xs text-blue-600 hover:text-blue-800">案件一覧 →</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-8 text-center text-sm text-zinc-400">今後の業務日が設定された案件はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {upcoming.map((a) => (
              <Link key={a.id} href={`/assignments/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50">
                <span className="shrink-0 text-xs text-zinc-500 tabular-nums w-24">{a.service_date}</span>
                <span className="flex-1 min-w-0"><span className="block text-sm text-zinc-900 truncate">{a.title ?? a.no}</span>{a.client && <span className="block text-xs text-zinc-400 truncate">{a.client}</span>}</span>
                {a.status && <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{a.status}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
