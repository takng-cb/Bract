/**
 * 自動車重量税の計算 — 純粋関数（#47 / 重量税）
 *
 * 重量税は「車種 × 車両重量(0.5tごと) × 経過年区分 × 検査有効期間(年)」で決まる**法定額**。
 * 公式の照会サイト（nextmvtt.mlit.go.jp）は車台番号からの個別照会のみで API が無いため、
 * 公表の税額（本則税率・経過年重課）を表として保持し計算する。
 *
 * 税額（年額）出典：自家用乗用車（2021-05 以降の恒久税率）。
 *   ※ 税率改定時は PER_YEAR と WEIGHT_TAX_REVISION を更新する。
 *   ※ エコカー減税（新車新規時の 免税/50%/25%）は継続検査では適用されない。
 *      本実装の 'eco' は「エコカー本則税率」を指す（継続検査向け）。
 */

export const WEIGHT_TAX_REVISION = '2021-05-01'

export type WtVehicleType = 'passenger' | 'kei'
//  passenger = 自家用乗用自動車（軽以外。0.5tごとに課税）
//  kei       = 軽自動車（自家用乗用。定額）

export type WtAgeCategory = 'eco' | 'normal' | 'over13' | 'over18'
//  eco    = エコカー（本則税率）
//  normal = 13年未満（非エコ）
//  over13 = 13年経過（〜17年）
//  over18 = 18年経過

/** 検査有効期間（年）。継続=2年、新車=3年、営業車等=1年。 */
export const WT_YEARS = [1, 2, 3] as const
export type WtYears = typeof WT_YEARS[number]

export const WT_AGE_LABEL: Record<WtAgeCategory, string> = {
  eco: 'エコカー（本則）', normal: '13年未満', over13: '13年経過', over18: '18年経過',
}
export const WT_TYPE_LABEL: Record<WtVehicleType, string> = {
  passenger: '自家用乗用（軽以外）', kei: '軽自動車（自家用乗用）',
}

/** 年額（円）。passenger は 0.5t ごと、kei は定額。 */
const PER_YEAR: Record<WtVehicleType, Record<WtAgeCategory, number>> = {
  passenger: { eco: 2500, normal: 4100, over13: 5700, over18: 6300 }, // 0.5t ごと
  kei:       { eco: 2500, normal: 3300, over13: 4100, over18: 4400 }, // 定額
}

export type WeightTaxResult = {
  amount: number
  vehicleType: WtVehicleType
  ageCategory: WtAgeCategory
  years: WtYears
  /** 0.5t ごとの区分数（kei は 1） */
  brackets: number
  perYear: number
  revision: string
}

/**
 * 重量税を算出する。普通車は重量(kg)必須（未指定/0 は null）。
 */
export function calcWeightTax(opts: {
  vehicleType: WtVehicleType
  ageCategory: WtAgeCategory
  years: WtYears
  /** 車両重量(kg)。passenger のみ使用 */
  weightKg?: number | null
}): WeightTaxResult | null {
  const { vehicleType, ageCategory, years } = opts
  if (!WT_YEARS.includes(years)) return null
  const perYear = PER_YEAR[vehicleType]?.[ageCategory]
  if (perYear == null) return null

  let brackets = 1
  if (vehicleType === 'passenger') {
    const w = opts.weightKg ?? 0
    if (!(w > 0)) return null // 普通車は重量必須
    brackets = Math.ceil(w / 500)
  }
  return {
    amount: brackets * perYear * years,
    vehicleType, ageCategory, years, brackets, perYear,
    revision: WEIGHT_TAX_REVISION,
  }
}

/** 車種記述（vehicle_kind 等）から車種区分を推定（「軽」を含めば kei） */
export function inferWtType(vehicleKind: string | null | undefined): WtVehicleType {
  return /軽/.test((vehicleKind ?? '').toString()) ? 'kei' : 'passenger'
}

/**
 * 初度登録年月から経過年区分を推定する。
 * @param firstRegYear 初度登録年（西暦）
 * @param refDateIso 基準日（省略時は呼び出し側で today を渡す）
 */
export function inferAgeCategory(firstRegYear: number | null | undefined, refYear: number): WtAgeCategory {
  if (!firstRegYear || firstRegYear <= 0) return 'normal'
  const age = refYear - firstRegYear
  if (age >= 18) return 'over18'
  if (age >= 13) return 'over13'
  return 'normal'
}
