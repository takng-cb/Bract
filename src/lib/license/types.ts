/**
 * ライセンス制御 — 型定義 (Issue #67)
 *
 * 機能フラグの型と関連エラー型を集約。
 */

/** ライセンスのプラン名 */
export type LicensePlan =
  | 'starter'
  | 'standard'
  | 'pro'
  | 'early_adopter'
  | 'enterprise'

/** ライセンスのステータス */
export type LicenseStatus =
  | 'active'      // 通常利用
  | 'trial'       // 試用期間
  | 'expired'     // 有効期限切れ
  | 'suspended'   // 利用停止

/** 機能フラグの種類 */
export type FeatureFlag =
  | 'ai_summary'         // AI まとめ機能
  | 'line_integration'   // LINE 連携
  | 'extra_industries'   // 追加業種（複数業種利用）
  | 'custom_documents'   // カスタム帳票
  | 'plaud_import'       // PLAUD Note 共有リンク取り込み（#143）

/** ライセンスの features オブジェクト */
export type LicenseFeatures = {
  ai_summary?:        boolean
  line_integration?:  boolean
  extra_industries?:  string[]                  // ['real-estate'] など
  custom_documents?:  boolean
  plaud_import?:      boolean                   // PLAUD Note 共有リンク取り込み（#143）
  max_users?:         number | null              // null = 無制限
  max_storage_mb?:    number | null
  // ── モジュール合成（#10 / ADR-0005/0016）。上限と表示を分離 ──
  entitled_modules?:  string[]                  // 契約で持てる上限（提供側のみ設定）
  enabled_modules?:   string[]                  // 上限内で今 ON にするもの（ランタイム合成の真実）
}

/** licenses テーブルの行を扱いやすくした型 */
export type License = {
  id:                     string
  tenant_key:             string
  plan:                   LicensePlan
  features:               LicenseFeatures
  industry_main:          string | null
  status:                 LicenseStatus
  starts_at:              Date | null
  expires_at:             Date | null
  stripe_subscription_id: string | null
  notes:                  string | null
  created_at:             Date
  updated_at:             Date
}

/** ライセンス未契約・機能オフ時に投げる専用エラー */
export class FeatureNotLicensedError extends Error {
  constructor(
    public readonly feature: FeatureFlag,
    message?: string,
  ) {
    super(message ?? `機能 "${feature}" はご契約プランに含まれていません。営業窓口までお問い合わせください。`)
    this.name = 'FeatureNotLicensedError'
  }
}

/** ライセンス自体が無効（expired / suspended）の時に投げるエラー */
export class LicenseInactiveError extends Error {
  constructor(public readonly status: LicenseStatus, message?: string) {
    super(message ?? `ご契約ライセンスが無効です (status: ${status})。営業窓口までお問い合わせください。`)
    this.name = 'LicenseInactiveError'
  }
}
