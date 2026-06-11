/**
 * 整備1件の請求合計・入金・残額の集計（REQ-0038）。
 *
 * MaintenanceFullView（全体ビューの各セクション）と整備詳細ページの
 * KPI サマリー（請求合計・残額）で共用し、計算ドリフトを防ぐ。
 * 一覧向けの一括集計は maintenanceReceivables.ts（別ロジック・将来統合候補）。
 */
import 'server-only'
import { db } from '@/lib/db'
import { maintenance_records, maintenance_line_items, maintenance_fees, maintenance_payments } from '@/lib/schema'
import { asc, eq } from 'drizzle-orm'

export const TAX_RATES: Record<string, number> = {
  '税別10%': 10, '税別8%': 8, '税込10%': 10, '税込8%': 8, '非課税': 0,
}

export type MaintenanceTotals = {
  laborSum: number
  partsSum: number
  partsCost: number
  linesTotal: number
  taxableFees: number
  nontaxableFees: number
  consumptionTax: number
  /** 請求合計（消費税込み） */
  grandTotal: number
  paidSum: number
  /** 残額 = grandTotal − paidSum */
  balance: number
  /** 粗利益 = 作業項目合計 − 部品原価 */
  grossProfit: number
  /** 税抜の請求対象合計（lines + 課税/非課税諸費用）。入金エディタの既定額に使用 */
  invoiceTotal: number
}

type LineLike = {
  is_excluded: boolean | null
  labor_amount: unknown
  parts_qty: unknown
  parts_unit_price: unknown
  cost_unit_price: unknown
}
type FeeLike = { category: string | null; amount: unknown }
type PaymentLike = { amount: unknown }

export function computeMaintenanceTotals(args: {
  lines: LineLike[]
  fees: FeeLike[]
  payments: PaymentLike[]
  taxMode: string | null
}): MaintenanceTotals {
  let laborSum = 0, partsSum = 0, partsCost = 0
  for (const l of args.lines) {
    if (l.is_excluded) continue
    const labor = Number(l.labor_amount ?? 0)
    const qty   = Number(l.parts_qty ?? 0)
    const unit  = Number(l.parts_unit_price ?? 0)
    const cost  = Number(l.cost_unit_price ?? 0)
    if (Number.isFinite(labor)) laborSum += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) partsSum += qty * unit
    if (Number.isFinite(qty) && Number.isFinite(cost)) partsCost += qty * cost
  }
  const linesTotal = laborSum + partsSum

  let taxableFees = 0, nontaxableFees = 0
  for (const f of args.fees) {
    const a = Number(f.amount ?? 0)
    if (f.category === '課税') {
      if (Number.isFinite(a)) taxableFees += a
    } else if (f.category === '非課税') {
      if (Number.isFinite(a)) nontaxableFees += a
    }
  }

  const taxRate = TAX_RATES[args.taxMode ?? '税別10%'] ?? 10
  const isTaxExternal = args.taxMode?.startsWith('税別') ?? true
  const consumptionTax = isTaxExternal
    ? Math.floor((linesTotal + taxableFees) * (taxRate / 100))
    : 0
  const grandTotal = linesTotal + taxableFees + consumptionTax + nontaxableFees

  const paidSum = args.payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0)

  return {
    laborSum, partsSum, partsCost, linesTotal,
    taxableFees, nontaxableFees, consumptionTax, grandTotal,
    paidSum,
    balance: grandTotal - paidSum,
    grossProfit: linesTotal - partsCost,
    invoiceTotal: linesTotal + taxableFees + nontaxableFees,
  }
}

/** DB から1整備分を取得して集計（詳細ページの KPI サマリー用） */
export async function getMaintenanceTotals(maintenanceId: string): Promise<MaintenanceTotals> {
  const [m, lines, fees, payments] = await Promise.all([
    db.select({ tax_mode: maintenance_records.tax_mode })
      .from(maintenance_records).where(eq(maintenance_records.id, maintenanceId))
      .then((r) => r[0] ?? null),
    db.select({
      is_excluded: maintenance_line_items.is_excluded,
      labor_amount: maintenance_line_items.labor_amount,
      parts_qty: maintenance_line_items.parts_qty,
      parts_unit_price: maintenance_line_items.parts_unit_price,
      cost_unit_price: maintenance_line_items.cost_unit_price,
    }).from(maintenance_line_items).where(eq(maintenance_line_items.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_line_items.sort_order)),
    db.select({ category: maintenance_fees.category, amount: maintenance_fees.amount })
      .from(maintenance_fees).where(eq(maintenance_fees.maintenance_id, maintenanceId)),
    db.select({ amount: maintenance_payments.amount })
      .from(maintenance_payments).where(eq(maintenance_payments.maintenance_id, maintenanceId)),
  ])
  return computeMaintenanceTotals({ lines, fees, payments, taxMode: m?.tax_mode ?? null })
}
