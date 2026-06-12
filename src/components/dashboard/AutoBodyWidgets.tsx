/**
 * 板金・自動車整備モジュールの状況ウィジェット群（#4 / #105）。
 *
 * 旧来はホーム（/dashboard）に集約していた auto-body 専用の運用ボード
 * （作業進行状況 / 代車中 / 要発注の部品 / 未入金 / 車検期限）を、
 * モジュール別ダッシュボード（/modules/auto-body）へ移設するために抽出した共通部品。
 *
 * widgetPrefs（scope='module:auto-body'。未設定時は旧グローバル設定にフォールバック）で
 * ウィジェットの表示/非表示・並びを制御できる（未指定＝既定表示）。
 */
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { vehicles, maintenance_records, accounts, contacts, customer_vehicles, parts, part_movements } from '@/lib/schema'
import { eq, desc, asc, ne, and, isNotNull, lte, count, notInArray } from 'drizzle-orm'
import { NavIcon } from '@/lib/navIcon'
import { formatDateLocal, todayLocal } from '@/lib/dateUtils'
import { calcStock, stockBadgeColor } from '@/industries/auto-body/lib/partsHelpers'
import { getReceivables, sumReceivables } from '@/industries/auto-body/lib/maintenanceReceivables'
import { STATUS_PALETTE, MAINTENANCE_STATUSES } from '@/industries/auto-body/lib/icons'
import { daysUntilInspection } from '@/industries/auto-body/lib/autoBodyService'
import type { DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { sortedVisibleModuleWidgets } from '@/lib/dashboard/moduleWidgets'

export default async function AutoBodyWidgets({ widgetPrefs }: { widgetPrefs?: DashboardWidgetPrefs | null }) {
  const visible = sortedVisibleModuleWidgets('auto-body', widgetPrefs)
  if (visible.length === 0) return null

  const inspectionLimitDate = new Date()
  inspectionLimitDate.setDate(inspectionLimitDate.getDate() + 30)
  const inspectionLimit = formatDateLocal(inspectionLimitDate)

  const [upcomingInspections, activeLoaners, allParts, allPartMovements, receivables] = await Promise.all([
    db.select({
      id: vehicles.id, maker: vehicles.maker, model: vehicles.model,
      license_plate: vehicles.license_plate, next_inspection_date: vehicles.next_inspection_date, status: vehicles.status,
    })
      .from(vehicles)
      .where(and(isNotNull(vehicles.next_inspection_date), lte(vehicles.next_inspection_date, inspectionLimit), ne(vehicles.status, '廃車')))
      .orderBy(asc(vehicles.next_inspection_date)).limit(20),
    db.select({
      maintenance_id: maintenance_records.id, maintenance_no: maintenance_records.maintenance_no,
      maintenance_status: maintenance_records.status, loaner_handover_at: maintenance_records.loaner_handover_at,
      vehicle: { id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate },
      customer_account: { id: accounts.id, name: accounts.name },
      customer_contact: { id: contacts.id, full_name: contacts.full_name },
      customer_vehicle: { id: customer_vehicles.id, plate_number: customer_vehicles.plate_number },
    })
      .from(maintenance_records)
      .innerJoin(vehicles, eq(maintenance_records.loaner_vehicle_id, vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .where(and(isNotNull(maintenance_records.loaner_vehicle_id), notInArray(maintenance_records.status, ['完了', 'キャンセル'])))
      .orderBy(desc(maintenance_records.loaner_handover_at)).limit(10),
    db.select({
      id: parts.id, part_number: parts.part_number, name: parts.name, reorder_level: parts.reorder_level,
      supplier: { id: accounts.id, name: accounts.name },
    }).from(parts).leftJoin(accounts, eq(parts.supplier_account_id, accounts.id)),
    db.select({ part_id: part_movements.part_id, movement_type: part_movements.movement_type, quantity: part_movements.quantity }).from(part_movements),
    getReceivables(10),
  ])

  // 作業進行状況（状態別件数）
  const workProgressCounts: Record<string, number> = {}
  for (const s of MAINTENANCE_STATUSES) workProgressCounts[s] = 0
  const statusRows = await db.select({ status: maintenance_records.status, c: count() })
    .from(maintenance_records)
    .where(notInArray(maintenance_records.status, ['完了', 'キャンセル']))
    .groupBy(maintenance_records.status)
  for (const r of statusRows) workProgressCounts[r.status] = Number(r.c ?? 0)
  const todayStr = todayLocal()
  const completedToday = await db.select({ c: count() })
    .from(maintenance_records)
    .where(and(eq(maintenance_records.status, '完了'), eq(maintenance_records.delivery_date, todayStr)))
  workProgressCounts['完了'] = Number(completedToday[0]?.c ?? 0)

  const totalReceivables = sumReceivables(receivables)

  const lowStockParts = (() => {
    if (allParts.length === 0) return []
    const byPart = new Map<string, { movement_type: string; quantity: number | null }[]>()
    for (const m of allPartMovements) {
      const arr = byPart.get(m.part_id) ?? []
      arr.push({ movement_type: m.movement_type, quantity: m.quantity })
      byPart.set(m.part_id, arr)
    }
    return allParts
      .map((p) => ({ ...p, stock: calcStock(byPart.get(p.id) ?? []) }))
      .filter((p) => p.stock <= (p.reorder_level ?? 0))
      .sort((a, b) => {
        if (a.stock === 0 && b.stock !== 0) return -1
        if (b.stock === 0 && a.stock !== 0) return 1
        return a.stock - b.stock
      })
      .slice(0, 10)
  })()

  // ウィジェット id → セクション（moduleWidgets.ts / widgets.ts の auto-body-* 定義と対）
  const sections: Record<string, ReactNode> = {
    // 作業進行状況
    'auto-body-work-progress': (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="📊" className="w-5 h-5" /> 作業進行状況</h2>
          <Link href="/maintenance" className="text-xs text-blue-600 hover:text-blue-800">整備一覧 →</Link>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了'] as const).map((status) => {
              const palette = STATUS_PALETTE[status]
              const c = workProgressCounts[status] ?? 0
              const isCompleted = status === '完了'
              return (
                <Link key={status} href={`/maintenance?f=status%3Deq%3A${encodeURIComponent(status)}`} className={`block rounded-lg border-2 p-3 hover:shadow-md transition-shadow ${palette.bg} ${palette.border}`}>
                  <p className={`text-xs font-medium ${palette.text} mb-1`}>{status}</p>
                  <p className={`text-2xl font-bold ${palette.text}`}>{c}</p>
                  {isCompleted && <p className="text-[10px] text-zinc-500 mt-0.5">本日納車</p>}
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    ),

    // 代車中の車両
    'auto-body-active-loaners': (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="🚙" className="w-5 h-5" /> 代車中の車両<span className="ml-2 text-zinc-400 font-normal text-sm">({activeLoaners.length})</span></h2>
          <Link href="/vehicles?f=status%3Deq%3A%E4%BB%A3%E8%BB%8A%E4%B8%AD" className="text-xs text-blue-600 hover:text-blue-800">代車中一覧 →</Link>
        </div>
        {activeLoaners.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">現在代車中の車両はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {activeLoaners.map((l) => {
              const customer = l.customer_account?.id ? l.customer_account.name : l.customer_contact?.id ? l.customer_contact.full_name : '—'
              return (
                <div key={l.maintenance_id} className="block px-4 py-3 hover:bg-zinc-50">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/vehicles/${l.vehicle.id}`} className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate">{l.vehicle.license_plate ?? '—'}<span className="text-xs text-zinc-400 ml-2">{l.vehicle.maker} {l.vehicle.model}</span></Link>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">{l.maintenance_status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-xs text-zinc-500">
                    <Link href={`/maintenance/${l.maintenance_id}`} className="hover:text-blue-600 truncate"><span className="inline-flex items-center gap-1"><NavIcon icon="🔧" className="w-3.5 h-3.5 shrink-0" /> {l.maintenance_no} ／ {customer}</span></Link>
                    {l.loaner_handover_at && <span className="shrink-0 text-zinc-400">貸出: {new Date(l.loaner_handover_at).toLocaleDateString('ja-JP')}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    ),

    // 要発注の部品
    'auto-body-low-stock-parts': (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="🔧" className="w-5 h-5" /> 要発注の部品<span className="ml-2 text-zinc-400 font-normal text-sm">({lowStockParts.length})</span></h2>
          <Link href="/parts" className="text-xs text-blue-600 hover:text-blue-800">部品マスタ →</Link>
        </div>
        {lowStockParts.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">発注しきい値を下回る部品はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {lowStockParts.map((p) => (
              <Link key={p.id} href={`/parts/${p.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">{p.name}<span className="text-xs text-zinc-400 ml-2 font-mono">{p.part_number}</span></p>
                    <p className="text-xs text-zinc-400 mt-0.5">発注しきい値 {p.reorder_level ?? 0} 個{p.supplier?.id && <span className="ml-2 inline-flex items-center gap-1"><NavIcon icon="🏢" className="w-3 h-3 shrink-0" />{p.supplier.name}</span>}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${stockBadgeColor(p.stock, p.reorder_level ?? 0)}`}>{p.stock === 0 ? '在庫切れ' : `残 ${p.stock} 個`}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    ),

    // 未入金の整備
    'auto-body-receivables': (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="💰" className="w-5 h-5" /> 未入金の整備<span className="ml-2 text-zinc-400 font-normal text-sm">({receivables.length})</span></h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">合計 <span className="font-mono font-bold text-rose-700">¥{totalReceivables.toLocaleString()}</span></span>
            <Link href="/receivables" className="text-xs text-blue-600 hover:text-blue-800">売掛金一覧 →</Link>
          </div>
        </div>
        {receivables.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">未入金の整備はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {receivables.map((r) => {
              const customer = r.account?.name ?? r.contact?.full_name ?? '—'
              const isOverdue30 = r.daysOverdue != null && r.daysOverdue > 30
              const isOverdue60 = r.daysOverdue != null && r.daysOverdue > 60
              return (
                <Link key={r.id} href={`/maintenance/${r.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 truncate">{customer}<span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 ml-2 align-middle">{r.status}</span></p>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate"><span className="inline-flex items-center gap-1"><NavIcon icon="🔧" className="w-3 h-3 shrink-0" />{r.maintenance_no}</span>{r.vehicle?.plate_number && <span className="ml-2 inline-flex items-center gap-1"><NavIcon icon="🚗" className="w-3 h-3 shrink-0" />{r.vehicle.plate_number}</span>}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-sm text-rose-700">¥{r.outstanding.toLocaleString()}</p>
                      {r.daysOverdue != null && (
                        <p className={`text-xs mt-0.5 ${isOverdue60 ? 'text-red-700 font-semibold' : isOverdue30 ? 'text-orange-700' : 'text-zinc-500'}`}>{r.daysOverdue < 0 ? `あと${-r.daysOverdue}日` : `${r.daysOverdue}日経過`}</p>
                      )}
                    </div>
                  </div>
                  {r.paidTotal > 0 && <p className="text-[10px] text-zinc-400 mt-1">一部入金済: ¥{r.paidTotal.toLocaleString()} / 請求 ¥{r.invoiceTotal.toLocaleString()}</p>}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    ),

    // 車検期限アラート
    'auto-body-upcoming-inspections': (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="🚗" className="w-5 h-5" /> 車検期限アラート<span className="ml-2 text-zinc-400 font-normal text-sm">(30日以内・経過)</span></h2>
          <Link href="/vehicles" className="text-xs text-blue-600 hover:text-blue-800">車両一覧 →</Link>
        </div>
        {upcomingInspections.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center text-sm text-zinc-400">対象車両はありません</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden">
            {upcomingInspections.map((v) => {
              const days = daysUntilInspection(v.next_inspection_date)
              const expired = days != null && days < 0
              const urgent = days != null && days >= 0 && days <= 7
              return (
                <Link key={v.id} href={`/vehicles/${v.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 truncate">{v.maker} {v.model}{v.license_plate && <span className="text-xs text-zinc-400 ml-2">{v.license_plate}</span>}</p>
                      <p className="text-xs text-zinc-400">{v.next_inspection_date} ・ {v.status}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${expired ? 'bg-red-50 text-red-700' : urgent ? 'bg-orange-50 text-orange-700' : 'bg-yellow-50 text-yellow-700'}`}>{days != null && (expired ? `${-days}日経過` : `あと${days}日`)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    ),
  }

  return (
    <section className="mb-8 space-y-6">
      {visible.map((w) => <Fragment key={w.id}>{sections[w.id]}</Fragment>)}
    </section>
  )
}
