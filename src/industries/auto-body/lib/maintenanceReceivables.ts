/**
 * 整備の売掛金（未入金）を集計するヘルパ群。— Issue #48 Phase 1
 *
 * スキーマ変更なしで、既存の maintenance_records + line_items + fees +
 * payments から動的に未入金額を算出する。
 *
 * 未入金（売掛金）の判定:
 *   - status NOT IN ('予約', 'キャンセル')   ← 売上計上対象（受付以降）
 *   - 請求合計 (lines + fees + 消費税) − 入金合計 > 0
 *
 * 経過日数:
 *   - 基準日 = sales_recording_date > delivery_date > intake_date
 *   - 今日との差を日数で算出（経過 = アジング）
 */
import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  maintenance_line_items, maintenance_fees, maintenance_payments,
} from '@/lib/schema'
import { eq, notInArray, inArray } from 'drizzle-orm'

const TAX_RATES: Record<string, number> = {
  '税別10%': 10, '税別8%': 8, '税込10%': 10, '税込8%': 8, '非課税': 0,
}

export type ReceivableRow = {
  id:               string
  maintenance_no:   string
  status:           string
  invoiceDate:      string | null  // invoice_issued_at > sales_recording_date > delivery_date > intake_date
  /** 請求書発行日 (Issue #48 Phase 2) */
  invoiceIssuedAt:  string | null
  /** 請求書番号 (Issue #48 Phase 2) */
  invoiceNo:        string | null
  /** 支払期限 (Issue #48 Phase 2) */
  paymentDueDate:   string | null
  /** 期限超過日数 (paymentDueDate − 今日)。null = 期限未設定 */
  daysPastDue:      number | null
  /** 請求先種別 ('顧客' / '保険会社' / 'リース会社' / 'その他') */
  billingTarget:    string | null
  /** 支払状況 (DB 明示値、無ければ outstanding から推定) */
  paymentStatus:    string
  /** 請求合計（消費税込み） */
  invoiceTotal:     number
  /** 入金合計 */
  paidTotal:        number
  /** 残額 = invoiceTotal − paidTotal */
  outstanding:      number
  /** 経過日数 (invoiceDate が null なら null) */
  daysOverdue:      number | null
  account:          { id: string; name: string } | null
  contact:          { id: string; full_name: string } | null
  vehicle:          { id: string; plate_number: string | null; car_model: string | null } | null
}

function pickInvoiceDate(m: {
  invoice_issued_at:    string | null
  sales_recording_date: string | null
  delivery_date:        string | null
  intake_date:          string | null
}): string | null {
  return m.invoice_issued_at ?? m.sales_recording_date ?? m.delivery_date ?? m.intake_date
}

function diffDays(fromIso: string, today: Date): number {
  const d = new Date(fromIso + 'T00:00:00')
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * 売上計上対象（status NOT IN 予約/キャンセル）の整備をすべて取得し、
 * 未入金（outstanding > 0）のみ返す。
 *
 * @param limit 返却件数の上限（省略時は全件）
 */
export async function getReceivables(limit?: number): Promise<ReceivableRow[]> {
  // 1. 売上計上対象の整備を取得
  const mRows = await db.select({
    m: maintenance_records,
    account: { id: accounts.id, name: accounts.name },
    contact: { id: contacts.id, full_name: contacts.full_name },
    vehicle: {
      id: customer_vehicles.id,
      plate_number: customer_vehicles.plate_number,
      car_model:    customer_vehicles.car_model,
    },
  })
    .from(maintenance_records)
    .leftJoin(accounts,          eq(maintenance_records.account_id,          accounts.id))
    .leftJoin(contacts,          eq(maintenance_records.contact_id,          contacts.id))
    .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
    .where(notInArray(maintenance_records.status, ['予約', 'キャンセル']))

  if (mRows.length === 0) return []
  const ids = mRows.map((r) => r.m.id)

  // 2. lines / fees / payments を bulk fetch
  const [lineRows, feeRows, paymentRows] = await Promise.all([
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
    db.select({
      maintenance_id: maintenance_payments.maintenance_id,
      amount:         maintenance_payments.amount,
    })
      .from(maintenance_payments)
      .where(inArray(maintenance_payments.maintenance_id, ids)),
  ])

  // 3. id → 集計マップ
  type Sums = { labor: number; parts: number; taxableFees: number; nontaxableFees: number; paid: number }
  const sumByMid = new Map<string, Sums>()
  for (const id of ids) sumByMid.set(id, { labor: 0, parts: 0, taxableFees: 0, nontaxableFees: 0, paid: 0 })

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
    if (f.category === '課税')        cur.taxableFees    += a
    else if (f.category === '非課税') cur.nontaxableFees += a
  }
  for (const p of paymentRows) {
    const cur = sumByMid.get(p.maintenance_id)
    if (!cur) continue
    const a = Number(p.amount ?? 0)
    if (Number.isFinite(a)) cur.paid += a
  }

  // 4. 各整備について請求合計を計算し、未入金のみ抽出
  const today = new Date()
  const rows: ReceivableRow[] = []
  for (const r of mRows) {
    const sums = sumByMid.get(r.m.id)
    if (!sums) continue

    const linesTotal = sums.labor + sums.parts
    const taxMode = r.m.tax_mode ?? '税別10%'
    const taxRate = TAX_RATES[taxMode] ?? 10
    const isTaxExternal = taxMode.startsWith('税別')
    const consumptionTax = isTaxExternal
      ? Math.floor((linesTotal + sums.taxableFees) * (taxRate / 100))
      : 0
    const invoiceTotal = linesTotal + sums.taxableFees + consumptionTax + sums.nontaxableFees
    const paidTotal    = sums.paid
    const outstanding  = invoiceTotal - paidTotal

    if (outstanding <= 0 || invoiceTotal === 0) continue  // 入金済 or 請求未確定

    const invoiceDate = pickInvoiceDate(r.m)
    const daysOverdue = invoiceDate ? diffDays(invoiceDate, today) : null

    // 支払期限超過日数（payment_due_date が設定されている場合のみ）
    const daysPastDue = r.m.payment_due_date
      ? diffDays(r.m.payment_due_date, today)
      : null

    // 明示的な payment_status があればそれを採用、無ければ outstanding から推定
    const explicitStatus = r.m.payment_status
    const derivedStatus = paidTotal === 0      ? '請求済'
                        : paidTotal < invoiceTotal ? '一部入金'
                        :                          '入金済'
    const paymentStatus = explicitStatus ?? derivedStatus

    rows.push({
      id:             r.m.id,
      maintenance_no: r.m.maintenance_no,
      status:         r.m.status,
      invoiceDate,
      invoiceIssuedAt: r.m.invoice_issued_at,
      invoiceNo:      r.m.invoice_no,
      paymentDueDate: r.m.payment_due_date,
      daysPastDue,
      billingTarget:  r.m.billing_target,
      paymentStatus,
      invoiceTotal:   Math.round(invoiceTotal),
      paidTotal:      Math.round(paidTotal),
      outstanding:    Math.round(outstanding),
      daysOverdue,
      account:        r.account?.id ? r.account : null,
      contact:        r.contact?.id ? r.contact : null,
      vehicle:        r.vehicle?.id ? r.vehicle : null,
    })
  }

  // 経過日数の多い順にソート（古い未入金が上位）。null は末尾。
  rows.sort((a, b) => {
    if (a.daysOverdue == null && b.daysOverdue == null) return 0
    if (a.daysOverdue == null) return 1
    if (b.daysOverdue == null) return -1
    return b.daysOverdue - a.daysOverdue
  })

  return limit != null ? rows.slice(0, limit) : rows
}

/** 売掛金合計（未入金額の合計） */
export function sumReceivables(rows: ReceivableRow[]): number {
  return rows.reduce((s, r) => s + r.outstanding, 0)
}
