/**
 * 自賠責保険（自動車損害賠償責任保険）の保険料計算 — 純粋関数（Issue #47）
 *
 * 自賠責は「車種 × 保険期間(月数) × 地域区分」で決まる**公定料率**（全社一律）。
 * ライブサイト（国交省 次世代自動車保有関係手続）をスクレイピングせず、
 * 公表されている料率表を定数として保持し、そこから算出する。
 *
 * 出典の料率表：**2023年4月1日 改定**（本土＝離島以外・沖縄以外）。
 *   ※ 料率は改定されることがあるため、改定時は下表を更新すること（RATE_REVISION を更新）。
 *   ※ 沖縄県・離島は別料率。本実装は当面「本土」のみ対応（mainland）。
 *
 * 参考: https://www.nextmvtt.mlit.go.jp/nextmvtt-web/nextmvttshokai/init （自賠責・重量税の照会）
 */

export const RATE_REVISION = '2023-04-01'

/** 車種区分（自賠責の料率区分。主要なもの） */
export type CaliVehicleClass = 'passenger' | 'kei'
//  passenger = 自家用乗用自動車（普通・小型の自家用乗用）
//  kei       = 軽自動車（検査対象・自家用乗用）

/** 地域区分（当面 本土のみ。将来 'okinawa' / 'remote-island' を追加可能） */
export type CaliRegion = 'mainland'

/** 自賠責で販売される標準的な保険期間（月） */
export const CALI_TERMS = [12, 13, 24, 25, 36, 37] as const
export type CaliTerm = typeof CALI_TERMS[number]

/** 料率表（円）。出典: 2023-04-01 改定・本土。 */
const RATE_TABLE: Record<CaliRegion, Record<CaliVehicleClass, Partial<Record<CaliTerm, number>>>> = {
  mainland: {
    passenger: { 12: 11500, 13: 12010, 24: 17650, 25: 18160, 36: 23690, 37: 24190 },
    kei:       { 12: 11440, 13: 11950, 24: 17540, 25: 18040, 36: 23520, 37: 24010 },
  },
}

export const CALI_CLASS_LABEL: Record<CaliVehicleClass, string> = {
  passenger: '自家用乗用自動車',
  kei:       '軽自動車（自家用）',
}

export type CaliResult = {
  premium: number
  vehicleClass: CaliVehicleClass
  term: CaliTerm
  region: CaliRegion
  revision: string
}

/**
 * 自賠責保険料を算出する。該当が無ければ null（呼び出し側で「要手入力」表示）。
 */
export function calcCaliPremium(opts: {
  vehicleClass: CaliVehicleClass
  months: number
  region?: CaliRegion
}): CaliResult | null {
  const region = opts.region ?? 'mainland'
  const term = opts.months as CaliTerm
  if (!CALI_TERMS.includes(term)) return null
  const premium = RATE_TABLE[region]?.[opts.vehicleClass]?.[term]
  if (premium == null) return null
  return { premium, vehicleClass: opts.vehicleClass, term, region, revision: RATE_REVISION }
}

/**
 * customer_vehicles.vehicle_kind 等の自由記述から車種区分を推定する。
 * 「軽」を含めば kei、それ以外は passenger（不明時のデフォルト）。
 */
export function inferCaliClass(vehicleKind: string | null | undefined): CaliVehicleClass {
  const s = (vehicleKind ?? '').toString()
  if (/軽/.test(s)) return 'kei'
  return 'passenger'
}

/** 選択肢としての期間ラベル（UI 用） */
export function caliTermLabel(term: CaliTerm): string {
  return `${term}ヶ月`
}
