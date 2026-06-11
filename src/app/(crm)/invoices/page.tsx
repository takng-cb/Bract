/**
 * /invoices — 売上・請求の一覧と月次集計（staffing Phase5 / REQ-0007 / #14）
 *
 * 案件の業務日（service_date）ベースで月ごとにグルーピングし、
 * 請求額・支払額・粗利の合計とステータスを一覧する。
 */
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { invoices, assignments, accounts } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireBookRead } from '@/lib/permissions'
import { NavIcon } from '@/lib/navIcon'

function yen(v: string | number | null): string {
  return v != null ? `¥${Number(v).toLocaleString()}` : '—'
}

const BILLING_TONE: Record<string, string> = {
  '未請求': 'bg-zinc-100 text-zinc-600',
  '請求済': 'bg-blue-50 text-blue-700',
  '入金済': 'bg-green-50 text-green-700',
}

export default async function InvoicesPage() {
  await requireBookRead('assignments')  // 請求は案件の付帯情報（RBAC は assignments に従う）
  if (!(await isModuleEnabled('staffing'))) notFound()

  const rows = await db.select({
    id: invoices.id,
    billing_amount: invoices.billing_amount,
    payment_amount: invoices.payment_amount,
    margin: invoices.margin,
    billing_status: invoices.billing_status,
    payment_status: invoices.payment_status,
    billed_at: invoices.billed_at,
    assignment: {
      id: assignments.id,
      title: assignments.title,
      assignment_no: assignments.assignment_no,
      service_date: assignments.service_date,
    },
    client: { id: accounts.id, name: accounts.name },
  })
    .from(invoices)
    .leftJoin(assignments, eq(invoices.assignment_id, assignments.id))
    .leftJoin(accounts, eq(assignments.client_account_id, accounts.id))
    .orderBy(desc(assignments.service_date), desc(invoices.created_at))

  // 月次グルーピング（業務日ベース。無ければ「日付未設定」）
  const byMonth = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.assignment?.service_date ? String(r.assignment.service_date).slice(0, 7) : '日付未設定'
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(r)
  }

  const sum = (list: typeof rows, key: 'billing_amount' | 'payment_amount' | 'margin') =>
    list.reduce((acc, r) => acc + Number(r[key] ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="💰" className="w-6 h-6" /> 売上・請求</h1>
        <p className="text-sm text-zinc-500 mt-1">
          全 {rows.length} 件 ・ 粗利合計 <span className="font-mono font-semibold text-emerald-700">{yen(sum(rows, 'margin'))}</span>
          <span className="ml-2 text-xs text-zinc-400">請求データは各案件の「売上・請求」セクションで作成します</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white py-20 text-center text-zinc-400">
          <p className="text-lg font-medium">請求データがまだありません</p>
          <p className="mt-1 text-sm">案件詳細の「売上・請求」から作成してください</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...byMonth.entries()].map(([month, list]) => (
            <section key={month} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                <h2 className="text-sm font-bold text-zinc-800">{month === '日付未設定' ? month : `${month.replace('-', '年')}月`}</h2>
                <span className="text-xs text-zinc-500">売上 <b className="font-mono">{yen(sum(list, 'billing_amount'))}</b></span>
                <span className="text-xs text-zinc-500">原価 <b className="font-mono">{yen(sum(list, 'payment_amount'))}</b></span>
                <span className="text-xs text-emerald-700">粗利 <b className="font-mono">{yen(sum(list, 'margin'))}</b></span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-100 bg-white">
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="px-3 py-2 font-medium">案件</th>
                    <th className="px-3 py-2 font-medium">派遣先</th>
                    <th className="px-3 py-2 font-medium">業務日</th>
                    <th className="px-3 py-2 text-right font-medium">請求額</th>
                    <th className="px-3 py-2 text-right font-medium">支払額</th>
                    <th className="px-3 py-2 text-right font-medium">粗利</th>
                    <th className="px-3 py-2 font-medium">請求</th>
                    <th className="px-3 py-2 font-medium">支払</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2">
                        {r.assignment ? (
                          <Link href={`/assignments/${r.assignment.id}`} className="font-medium text-blue-600 hover:underline">
                            {r.assignment.title ?? r.assignment.assignment_no}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{r.client?.name ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-600">{r.assignment?.service_date ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-800">{yen(r.billing_amount)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600">{yen(r.payment_amount)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{yen(r.margin)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${BILLING_TONE[r.billing_status] ?? 'bg-zinc-100 text-zinc-600'}`}>{r.billing_status}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${r.payment_status === '支払済' ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>{r.payment_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
