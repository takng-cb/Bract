/**
 * 日本の不動産仲介手数料の自動算出と利益計算（税抜ベース）
 *
 * ── 売買 ──────────────────────────────────────────
 * 売買仲介手数料の上限（宅建業法 2024年7月改正版）:
 *   - 売買代金 ≤ 800万円 → 30万円（低廉な空家等の媒介特例）
 *   - 売買代金 > 800万円 → 売買代金 × 3% + 6万円（速算式）
 *
 * ── 賃貸 ──────────────────────────────────────────
 * 賃貸仲介手数料の上限:
 *   - 総額 = 賃料の1ヶ月分（標準）
 *   - 居住用は片側 0.5ヶ月分、承諾で片側 1ヶ月分
 *   - 長期空家特例で貸主から最大 2ヶ月分（手動で上書きする想定）
 *
 * ── 利益 ──────────────────────────────────────────
 *   利益 = 仲介手数料 × (両手なら 2、それ以外 1) + その他利益
 */

export const TRANSACTION_TYPES = ['売買', '賃貸'] as const
export type TransactionType = typeof TRANSACTION_TYPES[number]

// 売買用の仲介種別
export const BROKERAGE_TYPES_SALE = ['両手', '売り', '買い'] as const
// 賃貸用の仲介種別
export const BROKERAGE_TYPES_RENT = ['両手', '貸主', '借主'] as const
// 全種別（バリデーション・互換性確認用）
export const BROKERAGE_TYPES_ALL = [
  ...BROKERAGE_TYPES_SALE,
  ...BROKERAGE_TYPES_RENT,
] as const

/** 取引区分に応じた仲介種別の選択肢を返す */
export function brokerageTypesFor(txType: string | null | undefined): readonly string[] {
  return txType === '賃貸' ? BROKERAGE_TYPES_RENT : BROKERAGE_TYPES_SALE
}

export const TEIREN_THRESHOLD = 8_000_000 // 800万円
export const TEIREN_FEE = 300_000          // 30万円

/** 売買代金から既定の仲介手数料（円、税抜）を算出。
 *  - 0以下や未入力は null。
 *  - 算出された手数料が売買代金を超える場合（例: 100円の物件で30万円固定）は null（手動入力に委ねる）。
 */
function defaultSaleFee(price: number): number | null {
  if (price <= 0) return null
  const fee = price <= TEIREN_THRESHOLD
    ? TEIREN_FEE
    : Math.round(price * 0.03 + 60_000)
  if (fee > price) return null
  return fee
}

/** 月額賃料から既定の仲介手数料（円、税抜）を算出。標準は賃料1ヶ月分。 */
function defaultRentFee(monthlyRent: number): number | null {
  if (monthlyRent <= 0) return null
  return Math.round(monthlyRent)
}

/** 取引区分と金額から既定の仲介手数料（円、税抜）を算出。 */
export function defaultCommissionFee(
  amount: number | null | undefined,
  txType: string | null | undefined = '売買',
): number | null {
  if (!amount || amount <= 0) return null
  return txType === '賃貸' ? defaultRentFee(amount) : defaultSaleFee(amount)
}

/** 算出根拠の説明文（UI表示用） */
export function commissionBreakdown(
  amount: number | null | undefined,
  txType: string | null | undefined = '売買',
): string {
  if (!amount || amount <= 0) return ''
  if (txType === '賃貸') return '賃料1ヶ月分（標準上限）'
  if (amount <= TEIREN_THRESHOLD) return '低廉特例（30万円）'
  return '売買代金 × 3% + 6万円'
}

/** 入力された仲介手数料が金額の何%にあたるかを返す。0以下や不正な場合は null。
 *  賃貸の場合は「ヶ月数」を返したいので、この関数は売買のみで使うのが妥当。
 */
export function effectiveCommissionRatePct(
  amount: number | null | undefined,
  fee: number | null | undefined,
): number | null {
  const a = Number(amount ?? 0)
  const f = Number(fee ?? 0)
  if (a <= 0 || f <= 0) return null
  return (f / a) * 100
}

/** 賃貸時の「賃料の何ヶ月分か」を返す。0以下や不正な場合は null。 */
export function effectiveCommissionMonths(
  monthlyRent: number | null | undefined,
  fee: number | null | undefined,
): number | null {
  const r = Number(monthlyRent ?? 0)
  const f = Number(fee ?? 0)
  if (r <= 0 || f <= 0) return null
  return f / r
}

/** 利益 = 仲介手数料 × (両手?2:1) + その他利益 */
export function calcProfit(
  fee: number | null | undefined,
  brokerageType: string | null | undefined,
  otherProfit: number | null | undefined,
): number {
  const f = Number(fee ?? 0)
  const m = brokerageType === '両手' ? 2 : 1
  const o = Number(otherProfit ?? 0)
  return f * m + o
}
