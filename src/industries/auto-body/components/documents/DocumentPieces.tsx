/**
 * 帳票テンプレートで共有する小部品。
 * - CompanyHeader: 自社情報（右上）
 * - CustomerHeader: 宛先（左上 = 顧客）
 * - LineItemsTable: 作業項目テーブル
 * - FeesTable: 諸費用テーブル
 * - TotalsBlock: 合計金額のまとめ
 * - SectionTitle: 帳票見出し
 */
import type { ReactNode } from 'react'
import { COMPANY_INFO } from '@/industries/auto-body/lib/companyInfo'

// ─── ヘルパ ─────────────────────────────────────
export function yen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `¥${Math.round(Number(n)).toLocaleString()}`
}

export function formatDateJa(d: string | null | undefined): string {
  if (!d) return '令和　年　月　日'
  // d は 'YYYY-MM-DD' 形式想定
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('ja-JP', { era: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return d
  }
}

// ─── 帳票タイトル ─────────────────────────────────
export function SectionTitle({ title, no }: { title: string; no?: string }) {
  return (
    <div className="mb-6 border-b-4 border-double border-zinc-700 pb-2 flex items-baseline justify-between">
      <h1 className="text-3xl font-bold tracking-widest">{title}</h1>
      {no && <span className="text-sm text-zinc-600 font-mono">No. {no}</span>}
    </div>
  )
}

// ─── 自社情報（右上ブロック） ─────────────────────
export function CompanyHeader({ issueDate, withSeal = true }: { issueDate?: string; withSeal?: boolean }) {
  return (
    <div className="text-right text-xs leading-relaxed">
      {issueDate && <p className="mb-2 text-sm">発行日: {issueDate}</p>}
      <p className="text-sm font-bold">{COMPANY_INFO.name}</p>
      <p>〒{COMPANY_INFO.postal_code}</p>
      <p>{COMPANY_INFO.address}</p>
      <p>TEL: {COMPANY_INFO.phone} / FAX: {COMPANY_INFO.fax}</p>
      <p>{COMPANY_INFO.certificate_number}</p>
      {withSeal && (
        <div className="mt-3 inline-block border-2 border-red-500 text-red-500 w-12 h-12 leading-[40px] text-center font-bold ml-auto">
          {COMPANY_INFO.receipt_seal}
        </div>
      )}
    </div>
  )
}

// ─── 宛先（左上ブロック） ─────────────────────────
export type CustomerInfo = {
  primaryName: string  // 取引先 (BtoB) or 顧客本人 (BtoC)
  attentionName?: string | null  // BtoB: 担当者
  address?: string | null
}

export function CustomerHeader({ customer, salutation = '御中' }: { customer: CustomerInfo; salutation?: string }) {
  return (
    <div className="text-base leading-relaxed">
      {customer.address && <p className="text-xs text-zinc-600">{customer.address}</p>}
      <p className="text-lg font-semibold border-b border-zinc-400 pb-1 inline-block min-w-[200px] mt-1">
        {customer.primaryName} <span className="ml-2 text-base">{salutation}</span>
      </p>
      {customer.attentionName && (
        <p className="text-sm text-zinc-700 mt-1">ご担当: {customer.attentionName} 様</p>
      )}
    </div>
  )
}

// ─── 車両ブロック ─────────────────────────────────
export type VehicleSummary = {
  plate_number?: string | null
  car_name?:     string | null
  car_model?:    string | null
  grade?:        string | null
  vin?:          string | null
  type_designation?: string | null
  mileage?:      number | null
}

export function VehicleBlock({ vehicle }: { vehicle: VehicleSummary }) {
  return (
    <table className="w-full text-sm border border-zinc-400 mb-4">
      <tbody>
        <tr>
          <th className="bg-zinc-100 border border-zinc-400 px-2 py-1 text-left w-24">ナンバー</th>
          <td className="border border-zinc-400 px-2 py-1">{vehicle.plate_number ?? '—'}</td>
          <th className="bg-zinc-100 border border-zinc-400 px-2 py-1 text-left w-24">車名/車種</th>
          <td className="border border-zinc-400 px-2 py-1">{[vehicle.car_name, vehicle.car_model, vehicle.grade].filter(Boolean).join(' / ') || '—'}</td>
        </tr>
        <tr>
          <th className="bg-zinc-100 border border-zinc-400 px-2 py-1 text-left">車台番号</th>
          <td className="border border-zinc-400 px-2 py-1 font-mono">{vehicle.vin ?? '—'}</td>
          <th className="bg-zinc-100 border border-zinc-400 px-2 py-1 text-left">型式</th>
          <td className="border border-zinc-400 px-2 py-1">{vehicle.type_designation ?? '—'}</td>
        </tr>
        {vehicle.mileage != null && (
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-2 py-1 text-left">走行距離</th>
            <td className="border border-zinc-400 px-2 py-1" colSpan={3}>{Number(vehicle.mileage).toLocaleString()} km</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// ─── 作業項目テーブル ─────────────────────────────
export type LineItem = {
  id:               string
  work_category:    string | null
  item_name:        string | null
  hours:            string | null
  labor_amount:     string | null
  parts_qty:        string | null
  parts_unit:       string | null
  parts_unit_price: string | null
  note:             string | null
  is_excluded:      boolean | null
  work_status:      string | null
}

export function LineItemsTable({ lines, showStatus = false, showHidden = false }: {
  lines: LineItem[]
  /** 「完了/未完了」列を表示するか */
  showStatus?: boolean
  /** 除外行も表示するか（請求書では非表示、作業指示書では表示） */
  showHidden?: boolean
}) {
  const visible = showHidden ? lines : lines.filter((l) => !l.is_excluded)
  if (visible.length === 0) {
    return <p className="text-sm text-zinc-500 italic mb-4">作業項目はありません</p>
  }
  return (
    <table className="w-full text-xs border-collapse border border-zinc-400 mb-4">
      <thead className="bg-zinc-100">
        <tr>
          <th className="border border-zinc-400 px-2 py-1 w-8">#</th>
          <th className="border border-zinc-400 px-2 py-1 w-16">区分</th>
          <th className="border border-zinc-400 px-2 py-1">作業項目</th>
          <th className="border border-zinc-400 px-2 py-1 w-12 text-right">工数</th>
          <th className="border border-zinc-400 px-2 py-1 w-20 text-right">工賃</th>
          <th className="border border-zinc-400 px-2 py-1 w-10 text-right">数</th>
          <th className="border border-zinc-400 px-2 py-1 w-12">単位</th>
          <th className="border border-zinc-400 px-2 py-1 w-20 text-right">単価</th>
          <th className="border border-zinc-400 px-2 py-1 w-20 text-right">小計</th>
          {showStatus && <th className="border border-zinc-400 px-2 py-1 w-12">完了</th>}
        </tr>
      </thead>
      <tbody>
        {visible.map((l, i) => {
          const labor = Number(l.labor_amount ?? 0)
          const qty   = Number(l.parts_qty ?? 0)
          const unit  = Number(l.parts_unit_price ?? 0)
          const sub   = (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0)
          return (
            <tr key={l.id} className={l.is_excluded ? 'text-zinc-400 line-through' : ''}>
              <td className="border border-zinc-400 px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-zinc-400 px-2 py-1">{l.work_category ?? ''}</td>
              <td className="border border-zinc-400 px-2 py-1">
                {l.item_name}
                {l.note && <span className="block text-[10px] text-zinc-500">{l.note}</span>}
              </td>
              <td className="border border-zinc-400 px-2 py-1 text-right">{l.hours ?? ''}</td>
              <td className="border border-zinc-400 px-2 py-1 text-right font-mono">{labor > 0 ? yen(labor) : ''}</td>
              <td className="border border-zinc-400 px-2 py-1 text-right">{l.parts_qty ?? ''}</td>
              <td className="border border-zinc-400 px-2 py-1">{l.parts_unit ?? ''}</td>
              <td className="border border-zinc-400 px-2 py-1 text-right font-mono">{unit > 0 ? yen(unit) : ''}</td>
              <td className="border border-zinc-400 px-2 py-1 text-right font-mono font-semibold">{yen(sub)}</td>
              {showStatus && (
                <td className="border border-zinc-400 px-2 py-1 text-center">
                  {l.work_status === '完了' ? '✓' : ''}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── 諸費用テーブル ───────────────────────────────
export type Fee = {
  id:          string
  category:    string  // '課税' | '非課税'
  item_name:   string
  amount:      string | null
}

export function FeesTable({ fees }: { fees: Fee[] }) {
  if (fees.length === 0) return null
  return (
    <table className="w-full text-xs border-collapse border border-zinc-400 mb-4">
      <thead className="bg-zinc-100">
        <tr>
          <th className="border border-zinc-400 px-2 py-1 w-16">区分</th>
          <th className="border border-zinc-400 px-2 py-1">項目</th>
          <th className="border border-zinc-400 px-2 py-1 w-24 text-right">金額</th>
        </tr>
      </thead>
      <tbody>
        {fees.map((f) => (
          <tr key={f.id}>
            <td className="border border-zinc-400 px-2 py-1">{f.category}</td>
            <td className="border border-zinc-400 px-2 py-1">{f.item_name}</td>
            <td className="border border-zinc-400 px-2 py-1 text-right font-mono">{yen(Number(f.amount))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── 合計ブロック ─────────────────────────────────
export type TotalsBreakdown = {
  laborSum:      number
  partsSum:      number
  taxableFees:   number
  nontaxableFees:number
  consumptionTax:number
  grandTotal:    number
}

export function TotalsBlock({ totals }: { totals: TotalsBreakdown }) {
  return (
    <div className="flex justify-end mb-4">
      <table className="text-sm border-collapse border border-zinc-400 w-72">
        <tbody>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">作業代計</th>
            <td className="border border-zinc-400 px-3 py-1.5 text-right font-mono">{yen(totals.laborSum)}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">部品代計</th>
            <td className="border border-zinc-400 px-3 py-1.5 text-right font-mono">{yen(totals.partsSum)}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">諸費用（課税）</th>
            <td className="border border-zinc-400 px-3 py-1.5 text-right font-mono">{yen(totals.taxableFees)}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">諸費用（非課税）</th>
            <td className="border border-zinc-400 px-3 py-1.5 text-right font-mono">{yen(totals.nontaxableFees)}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">消費税</th>
            <td className="border border-zinc-400 px-3 py-1.5 text-right font-mono">{yen(totals.consumptionTax)}</td>
          </tr>
          <tr className="bg-yellow-50">
            <th className="border border-zinc-400 px-3 py-2 text-left text-base font-bold">合計</th>
            <td className="border border-zinc-400 px-3 py-2 text-right font-mono font-bold text-base">{yen(totals.grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── 振込先（請求書用） ───────────────────────────
export function BankAccountBlock() {
  const b = COMPANY_INFO.bank_account
  return (
    <div className="border border-zinc-400 p-3 text-sm">
      <p className="font-semibold mb-1">お振込先</p>
      <p>{b.bank} {b.branch}</p>
      <p>{b.type} {b.number}</p>
      <p>{b.holder}</p>
    </div>
  )
}

// ─── 備考枠 ───────────────────────────────────────
export function NoteBox({ title, content }: { title: string; content: ReactNode }) {
  return (
    <div className="border border-zinc-400 p-3 text-sm mb-4">
      <p className="font-semibold mb-1">{title}</p>
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  )
}
