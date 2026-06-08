/**
 * 板金屋・自動車整備業 (auto-body) 用の業種ロジック
 *
 * - 商談 (opportunities) のサービス区分・利益計算
 * - 車両 (vehicles) の状態定数
 *
 * 利益（税抜）= 売上(amount) − 部品仕入原価(parts_cost)
 * 車両販売の場合: parts_cost に車両仕入原価を含めて入力する
 *                （自動補完は v2 の課題、v1 は手動入力）
 */

// ── 商談のサービス区分 ──────────────────────────────
export const SERVICE_TYPES = ['車両販売', '板金修理', '整備', '車検', 'その他'] as const
export type ServiceType = typeof SERVICE_TYPES[number]

// ── 車両の状態 ──────────────────────────────
//   '代車中' は整備の loaner_vehicle_id にセットされた際に
//   actions/maintenance.ts の syncLoanerVehicleStatus が自動で立てる。
//   整備完了/キャンセル時に '在庫' に戻る。
export const VEHICLE_STATUSES = [
  '在庫',
  '代車中',
  '販売済',
  '修理中',
  'メンテ中',
  '車検中',
  '納車待ち',
  '廃車',
] as const
export type VehicleStatus = typeof VEHICLE_STATUSES[number]

/** 車両の状態に応じたバッジ色（Tailwind） */
export function vehicleStatusColor(status: string | null | undefined): string {
  // semantic tone トークンで統一（ADR-0021）
  switch (status) {
    case '在庫':     return 'bg-info-bg text-info'
    case '代車中':   return 'bg-info-bg text-info'
    case '販売済':   return 'bg-positive-bg text-positive'
    case '修理中':   return 'bg-warning-bg text-warning'
    case 'メンテ中': return 'bg-warning-bg text-warning'
    case '車検中':   return 'bg-ai-bg text-ai'
    case '納車待ち': return 'bg-brand-50 text-brand-700'
    case '廃車':     return 'bg-n-100 text-n-600'
    default:         return 'bg-n-100 text-n-600'
  }
}

/** 利益（税抜）= 売上 − 部品仕入原価 */
export function calcAutoBodyProfit(
  amount: number | null | undefined,
  partsCost: number | null | undefined,
): number {
  const a = Number(amount ?? 0)
  const p = Number(partsCost ?? 0)
  return a - p
}

/** 次回車検まで何日か。期限切れなら負の数。null は「未設定」を示す。 */
export function daysUntilInspection(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const ms  = d.getTime() - now.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
