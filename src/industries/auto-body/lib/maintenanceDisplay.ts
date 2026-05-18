/**
 * 整備（maintenance_records）の表示名（レコード名）生成ロジック。
 *
 * 形式: `{受付日YYYYMMDD}_{顧客}_{車種}`
 *   - 受付日: maintenance_records.intake_date を YYYYMMDD 形式に
 *   - 顧客:   取引先が実体ある会社なら会社名、BtoC（取引先 NULL or「個人」）なら担当者氏名
 *   - 車種:   customer_vehicles.car_model（無ければ car_name にフォールバック）
 *
 * 例:
 *   - BtoC:  20260518_山田花子_ハリアー
 *   - BtoB:  20260518_株式会社サンプル_ヴェルファイア
 *
 * maintenance_no は別途「整備No」（YYYYMMDD-NNN 形式の連番）として残り、
 * 内部 ID/参照キーとして利用される。本ヘルパは UI 表示用。
 */
import { customerPrimaryName } from './customerDisplay'

/** ISO 日付（YYYY-MM-DD）を YYYYMMDD に変換。null/未設定は '00000000' で埋める。 */
export function formatDateYYYYMMDD(date: string | null | undefined): string {
  if (!date) return '00000000'
  return date.replace(/[-/]/g, '')
}

/** 文字列を表示名に使える形に整える（区切り文字や前後空白を削除） */
function sanitize(s: string | null | undefined): string {
  if (!s) return '—'
  return s.trim().replace(/_/g, '＿').replace(/\s+/g, '') || '—'
}

type MaintenanceLike = { intake_date?: string | null }
type AccountLike    = { name?: string | null } | null | undefined
type ContactLike    = { full_name?: string | null } | null | undefined
type VehicleLike    = { car_model?: string | null; car_name?: string | null } | null | undefined

/** 整備レコードの表示名を組み立てる */
export function maintenanceDisplayName(
  m:       MaintenanceLike,
  account: AccountLike,
  contact: ContactLike,
  vehicle: VehicleLike,
): string {
  const datePart    = formatDateYYYYMMDD(m.intake_date)
  const customer    = sanitize(customerPrimaryName(account, contact))
  const carRaw      = vehicle?.car_model || vehicle?.car_name || null
  const carPart     = sanitize(carRaw)
  return `${datePart}_${customer}_${carPart}`
}
