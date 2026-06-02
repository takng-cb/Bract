/**
 * 整備 (maintenance_records) を売上予測に組み入れるためのヘルパ群。
 *
 * auto-body 業種では整備が主収益源のため、ダッシュボード/売上予測の
 * 「想定売上」は 商談 (opportunities) + 整備 (maintenance_records) で
 * まとめる。
 *
 * 期間振り分け基準（優先度）:
 *   sales_recording_date > delivery_date > intake_date
 *
 * 確度（status → probability）:
 *   予約: 50% / 受付: 80% / 作業中: 95% / 納車待ち: 99% / 完了: 100%
 *   キャンセル: 集計対象外
 */
import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  maintenance_line_items, maintenance_fees,
} from '@/lib/schema'
import { eq, and, gte, lte, ne, or, inArray, isNotNull } from 'drizzle-orm'

export const MAINTENANCE_STATUS_PROBABILITY: Record<string, number> = {
  '予約':       50,
  '受付':       80,
  '作業中':     95,
  '部品待ち':   90,  // 部品調達待ち、確度は作業中よりわずかに低い
  '納車待ち':   99,
  '完了':      100,
  'キャンセル':  0,
}

export type MaintenanceForecastRow = {
  id:                 string
  maintenance_no:     string
  status:             string
  intake_date:        string | null
  delivery_date:      string | null
  sales_recording_date: string | null
  /** 売上予測の基準日 */
  forecastDate:       string
  account:            { id: string; name: string } | null
  contact:            { id: string; full_name: string } | null
  vehicle:            { id: string; plate_number: string | null; car_name: string | null; car_model: string | null } | null
  /** 売上 (税抜): labor + parts + taxableFees + nontaxableFees */
  salesAmount:        number
  /** 確度 (%) */
  probability:        number
  /** 確度を加味した想定売上 */
  weightedRevenue:    number
}

/** maintenance.forecastDate を取得 (sales_recording_date > delivery_date > intake_date) */
function pickForecastDate(m: { sales_recording_date: string | null; delivery_date: string | null; intake_date: string | null }): string | null {
  return m.sales_recording_date ?? m.delivery_date ?? m.intake_date
}

/**
 * 期間内（from〜to）の整備を、売上予測用に集計して返す。
 * - キャンセル除外
 * - 各レコードについて lines + fees を集計済みで含める
 */
export async function getMaintenanceForecast(from: string, to: string): Promise<MaintenanceForecastRow[]> {
  // 1. forecastDate が期間内の整備を取得（キャンセル除外）
  //    sales_recording_date 優先のため WHERE は OR で 3 カラムをチェック。
  //    JS 側で再確認＆forecastDate 決定する。
  const mRows = await db.select({
    m: maintenance_records,
    account: { id: accounts.id, name: accounts.name },
    contact: { id: contacts.id, full_name: contacts.full_name },
    vehicle: {
      id: customer_vehicles.id,
      plate_number: customer_vehicles.plate_number,
      car_name:     customer_vehicles.car_name,
      car_model:    customer_vehicles.car_model,
    },
  })
    .from(maintenance_records)
    .leftJoin(accounts,          eq(maintenance_records.account_id,         accounts.id))
    .leftJoin(contacts,          eq(maintenance_records.contact_id,         contacts.id))
    .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
    .where(and(
      ne(maintenance_records.status, 'キャンセル'),
      // 期間範囲チェックは forecastDate が from〜to に入るもの
      // SQL では 3 カラムのうちいずれかが範囲内であれば候補に拾い、JS 側で
      // forecastDate を厳密に判定。
      or(
        and(isNotNull(maintenance_records.sales_recording_date),
            gte(maintenance_records.sales_recording_date, from),
            lte(maintenance_records.sales_recording_date, to)),
        and(isNotNull(maintenance_records.delivery_date),
            gte(maintenance_records.delivery_date, from),
            lte(maintenance_records.delivery_date, to)),
        and(isNotNull(maintenance_records.intake_date),
            gte(maintenance_records.intake_date, from),
            lte(maintenance_records.intake_date, to)),
      ),
    ))

  const candidates = mRows
    .map((r) => {
      const fd = pickForecastDate(r.m)
      return fd && fd >= from && fd <= to ? { ...r, forecastDate: fd } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (candidates.length === 0) return []

  const ids = candidates.map((c) => c.m.id)

  // 2. lines / fees を bulk fetch → JS で合計
  const [lineRows, feeRows] = await Promise.all([
    db.select({
      maintenance_id:   maintenance_line_items.maintenance_id,
      is_excluded:      maintenance_line_items.is_excluded,
      labor_amount:     maintenance_line_items.labor_amount,
      parts_qty:        maintenance_line_items.parts_qty,
      parts_unit_price: maintenance_line_items.parts_unit_price,
    })
      .from(maintenance_line_items)
      .where(inArray(maintenance_line_items.maintenance_id, ids)),
    db.select({
      maintenance_id: maintenance_fees.maintenance_id,
      category:       maintenance_fees.category,
      amount:         maintenance_fees.amount,
    })
      .from(maintenance_fees)
      .where(inArray(maintenance_fees.maintenance_id, ids)),
  ])

  // 3. id → 集計マップ
  const sumByMid = new Map<string, { labor: number; parts: number; taxableFees: number; nontaxableFees: number }>()
  for (const id of ids) sumByMid.set(id, { labor: 0, parts: 0, taxableFees: 0, nontaxableFees: 0 })

  for (const l of lineRows) {
    if (l.is_excluded) continue
    const cur = sumByMid.get(l.maintenance_id)
    if (!cur) continue
    const labor = Number(l.labor_amount ?? 0)
    const qty   = Number(l.parts_qty ?? 0)
    const unit  = Number(l.parts_unit_price ?? 0)
    if (Number.isFinite(labor)) cur.labor += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) cur.parts += qty * unit
  }
  for (const f of feeRows) {
    const cur = sumByMid.get(f.maintenance_id)
    if (!cur) continue
    const a = Number(f.amount ?? 0)
    if (!Number.isFinite(a)) continue
    if (f.category === '課税')   cur.taxableFees    += a
    else if (f.category === '非課税') cur.nontaxableFees += a
  }

  // 4. 行を組み立て
  return candidates.map((r) => {
    const sums = sumByMid.get(r.m.id) ?? { labor: 0, parts: 0, taxableFees: 0, nontaxableFees: 0 }
    const salesAmount   = sums.labor + sums.parts + sums.taxableFees + sums.nontaxableFees
    const probability   = MAINTENANCE_STATUS_PROBABILITY[r.m.status] ?? 100
    const weightedRevenue = salesAmount * (probability / 100)
    return {
      id:                 r.m.id,
      maintenance_no:     r.m.maintenance_no,
      status:             r.m.status,
      intake_date:        r.m.intake_date,
      delivery_date:      r.m.delivery_date,
      sales_recording_date: r.m.sales_recording_date,
      forecastDate:       r.forecastDate,
      account:            r.account?.id ? r.account : null,
      contact:            r.contact?.id ? r.contact : null,
      vehicle:            r.vehicle?.id ? r.vehicle : null,
      salesAmount,
      probability,
      weightedRevenue,
    }
  })
}

/** 整備配列から想定売上合計を計算 */
export function sumMaintenanceWeighted(rows: MaintenanceForecastRow[]): number {
  return rows.reduce((s, r) => s + r.weightedRevenue, 0)
}

/** 整備配列から「完了」のみの売上合計（受注済相当） */
export function sumMaintenanceCompleted(rows: MaintenanceForecastRow[]): number {
  return rows.filter((r) => r.status === '完了').reduce((s, r) => s + r.salesAmount, 0)
}
