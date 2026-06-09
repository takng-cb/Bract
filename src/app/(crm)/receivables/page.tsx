/**
 * 売掛金（未入金）一覧ページ — Issue #48 Phase 1
 *
 * 既存の maintenance_records + line_items + fees + payments から
 * 動的に未入金額を計算して表示。スキーマ変更なし。
 *
 * 表示構成:
 *   1. アジング集計カード (0-30 / 30-60 / 60-90 / 90+ 日)
 *   2. 顧客別集計（未入金合計の多い順、上位 5 件）
 *   3. 未入金整備の全件リスト
 *
 * 売上計上対象（status NOT IN 予約/キャンセル）かつ
 * 請求合計 − 入金合計 > 0 のもののみ表示。
 */
export const dynamic = 'force-dynamic'

import { isModuleEnabled } from '@/lib/modules/registry'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getReceivables, sumReceivables, type ReceivableRow } from '@/industries/auto-body/lib/maintenanceReceivables'
import { NavIcon } from '@/lib/navIcon'

const AGING_BUCKETS = [
  { label: '0–30日',  min: 0,   max: 30,    color: 'bg-zinc-50  text-zinc-700  border-zinc-200' },
  { label: '31–60日', min: 31,  max: 60,    color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { label: '61–90日', min: 61,  max: 90,    color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { label: '90日超',  min: 91,  max: Infinity, color: 'bg-rose-50  text-rose-700  border-rose-200' },
] as const

function bucketOf(daysOverdue: number | null): typeof AGING_BUCKETS[number] | null {
  if (daysOverdue == null) return null
  if (daysOverdue < 0) return null  // まだ請求日が未来
  for (const b of AGING_BUCKETS) {
    if (daysOverdue >= b.min && daysOverdue <= b.max) return b
  }
  return null
}

export default async function ReceivablesPage() {
  if (!(await isModuleEnabled('auto-body'))) notFound()

  const rows = await getReceivables()
  const total = sumReceivables(rows)

  // ── アジング集計 ─────────────────────────────────────
  const agingTotals = new Map<string, { count: number; total: number }>()
  for (const b of AGING_BUCKETS) agingTotals.set(b.label, { count: 0, total: 0 })
  let nullBucket = { count: 0, total: 0 }       // 請求日未設定
  let futureBucket = { count: 0, total: 0 }     // 請求日が未来（請求前）
  for (const r of rows) {
    if (r.daysOverdue == null) {
      nullBucket.count++
      nullBucket.total += r.outstanding
      continue
    }
    if (r.daysOverdue < 0) {
      futureBucket.count++
      futureBucket.total += r.outstanding
      continue
    }
    const b = bucketOf(r.daysOverdue)
    if (!b) continue
    const cur = agingTotals.get(b.label)!
    cur.count++
    cur.total += r.outstanding
  }

  // ── 顧客別集計（上位 5） ─────────────────────────────
  type CustomerAgg = { key: string; label: string; href: string | null; count: number; total: number }
  const byCustomer = new Map<string, CustomerAgg>()
  for (const r of rows) {
    let key: string, label: string, href: string | null
    if (r.account?.id) {
      key = `account:${r.account.id}`
      label = r.account.name
      href = `/accounts/${r.account.id}`
    } else if (r.contact?.id) {
      key = `contact:${r.contact.id}`
      label = r.contact.full_name
      href = `/contacts/${r.contact.id}`
    } else {
      key = 'unknown'
      label = '（顧客不明）'
      href = null
    }
    const cur = byCustomer.get(key)
    if (cur) {
      cur.count++
      cur.total += r.outstanding
    } else {
      byCustomer.set(key, { key, label, href, count: 1, total: r.outstanding })
    }
  }
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="💰" className="w-6 h-6" />売掛金（未入金）</h1>
        <p className="text-sm text-zinc-500 mt-1">
          売上計上対象の整備で、入金が完了していないものを表示。
        </p>
      </div>

      {/* 合計サマリー */}
      <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-lg p-6 mb-6">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-rose-700">未入金合計</p>
          <p className="text-xs text-rose-600">{rows.length} 件</p>
        </div>
        <p className="text-3xl font-bold font-mono text-rose-800 mt-2">¥{total.toLocaleString()}</p>
      </div>

      {/* アジング集計 */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-3">経過日数別</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGING_BUCKETS.map((b) => {
            const v = agingTotals.get(b.label) ?? { count: 0, total: 0 }
            return (
              <div key={b.label} className={`border rounded-lg p-4 ${b.color}`}>
                <p className="text-xs font-semibold mb-1">{b.label}</p>
                <p className="text-xl font-bold font-mono">¥{v.total.toLocaleString()}</p>
                <p className="text-xs mt-1 opacity-70">{v.count} 件</p>
              </div>
            )
          })}
        </div>
        {(nullBucket.count > 0 || futureBucket.count > 0) && (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-500">
            {nullBucket.count > 0 && (
              <span>請求日未設定: {nullBucket.count} 件 / ¥{nullBucket.total.toLocaleString()}</span>
            )}
            {futureBucket.count > 0 && (
              <span>請求日が未来: {futureBucket.count} 件 / ¥{futureBucket.total.toLocaleString()}</span>
            )}
          </div>
        )}
      </section>

      {/* 顧客別 */}
      {topCustomers.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-3">未入金額の大きい顧客 (上位 5)</h2>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {topCustomers.map((c) => (
              <div key={c.key} className="flex items-center justify-between px-4 py-3">
                {c.href ? (
                  <Link href={c.href} className="text-sm font-medium text-blue-600 hover:underline truncate">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-500">{c.label}</span>
                )}
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-zinc-500">{c.count} 件</span>
                  <span className="font-mono font-bold text-rose-700">¥{c.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 全件リスト */}
      <section>
        <h2 className="text-sm font-bold text-zinc-700 mb-3">未入金整備 全件 ({rows.length})</h2>
        {rows.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-12 text-center text-sm text-zinc-400">
            未入金の整備はありません
          </div>
        ) : (
          <ReceivablesTable rows={rows} />
        )}
      </section>
    </div>
  )
}

function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  return (
    <>
      {/* PC: テーブル */}
      <div className="hidden md:block bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">整備No / 請求No</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">顧客 / 請求先</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">車両</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">請求日</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">支払期限</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">支払状況</th>
              <th className="text-right px-3 py-2 font-medium text-zinc-600">請求額</th>
              <th className="text-right px-3 py-2 font-medium text-zinc-600">入金済</th>
              <th className="text-right px-3 py-2 font-medium text-zinc-600">未入金</th>
              <th className="text-right px-3 py-2 font-medium text-zinc-600">経過</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const customer = r.account?.id
                ? <Link href={`/accounts/${r.account.id}`} className="text-blue-600 hover:underline">{r.account.name}</Link>
                : r.contact?.id
                ? <Link href={`/contacts/${r.contact.id}`} className="text-blue-600 hover:underline">{r.contact.full_name}</Link>
                : <span className="text-zinc-400">—</span>
              const isOverdue30 = r.daysOverdue != null && r.daysOverdue > 30
              const isOverdue60 = r.daysOverdue != null && r.daysOverdue > 60
              return (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <Link href={`/maintenance/${r.id}`} className="font-mono text-xs text-blue-600 hover:underline">{r.maintenance_no}</Link>
                    {r.invoiceNo && <p className="text-[10px] text-zinc-400 mt-0.5">請求 {r.invoiceNo}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {customer}
                    {r.billingTarget && <p className="text-[10px] text-zinc-400 mt-0.5">{r.billingTarget}</p>}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {r.vehicle?.plate_number ?? '—'}
                    {r.vehicle?.car_model && <span className="text-xs text-zinc-400 ml-1">{r.vehicle.car_model}</span>}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">{r.invoiceIssuedAt ?? r.invoiceDate ?? '—'}</td>
                  <td className={`px-3 py-2 text-xs whitespace-nowrap ${
                    r.daysPastDue != null && r.daysPastDue > 0 ? 'text-red-700 font-semibold' :
                    r.daysPastDue != null && r.daysPastDue > -7 ? 'text-orange-700' :
                    'text-zinc-500'
                  }`}>
                    {r.paymentDueDate ?? '—'}
                    {r.daysPastDue != null && r.daysPastDue > 0 && (
                      <p className="text-[10px] mt-0.5">{r.daysPastDue}日超過</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      r.paymentStatus === '貸倒'    ? 'bg-red-100 text-red-800' :
                      r.paymentStatus === '一部入金' ? 'bg-yellow-100 text-yellow-800' :
                      r.paymentStatus === '請求済'   ? 'bg-blue-100 text-blue-800' :
                      r.paymentStatus === '未請求'   ? 'bg-zinc-100 text-zinc-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>{r.paymentStatus}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-700">¥{r.invoiceTotal.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-500">{r.paidTotal > 0 ? `¥${r.paidTotal.toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">¥{r.outstanding.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right text-xs whitespace-nowrap ${
                    isOverdue60 ? 'text-red-700 font-semibold' :
                    isOverdue30 ? 'text-orange-700' :
                    'text-zinc-500'
                  }`}>
                    {r.daysOverdue == null ? '—'
                      : r.daysOverdue < 0 ? `あと${-r.daysOverdue}日`
                      : `${r.daysOverdue}日`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* モバイル: カード */}
      <div className="md:hidden space-y-2">
        {rows.map((r) => {
          const customerName = r.account?.name ?? r.contact?.full_name ?? '—'
          const isOverdue30 = r.daysOverdue != null && r.daysOverdue > 30
          const isOverdue60 = r.daysOverdue != null && r.daysOverdue > 60
          return (
            <Link key={r.id} href={`/maintenance/${r.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 truncate">{customerName}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    <span className="font-mono">{r.maintenance_no}</span>
                    {r.vehicle?.plate_number && <span className="ml-2 inline-flex items-center gap-1"><NavIcon icon="🚗" className="w-3 h-3 shrink-0" />{r.vehicle.plate_number}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-sm text-rose-700">¥{r.outstanding.toLocaleString()}</p>
                  {r.daysOverdue != null && (
                    <p className={`text-xs mt-0.5 ${
                      isOverdue60 ? 'text-red-700 font-semibold' :
                      isOverdue30 ? 'text-orange-700' :
                      'text-zinc-500'
                    }`}>
                      {r.daysOverdue < 0 ? `あと${-r.daysOverdue}日` : `${r.daysOverdue}日経過`}
                    </p>
                  )}
                </div>
              </div>
              {r.paidTotal > 0 && (
                <p className="text-[10px] text-zinc-400 mt-1">
                  一部入金済: ¥{r.paidTotal.toLocaleString()} / 請求 ¥{r.invoiceTotal.toLocaleString()}
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
