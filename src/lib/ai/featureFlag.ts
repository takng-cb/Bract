/**
 * AI 機能の有効化フラグ — 互換レイヤー (Issue #67 で license モジュールに移行済み)
 *
 * 経緯:
 *   旧実装は env 変数 `AI_FEATURE_ENABLED` 単独で判定していた。
 *   #67 で license 制御を導入し、DB ベースの機能フラグも考慮するため
 *   `@/lib/license` の hasFeature / ensureFeature にデリゲートする。
 *
 *   - DB licenses.features.ai_summary が ON → 有効
 *   - env AI_FEATURE_ENABLED=true   → 強制的に有効（DB に関わらず）
 *   - env AI_FEATURE_ENABLED=false  → 強制的に無効（kill switch）
 *
 * 既存呼び出し元の互換性のため、関数名・エラー型は維持する。
 * すべて async になっているので呼び出し側で await が必要。
 */
import 'server-only'
import { hasFeature, ensureFeature, FeatureNotLicensedError, LicenseInactiveError } from '@/lib/license'

/**
 * AI 機能が現在テナントで利用可能か。
 */
export async function isAIFeatureEnabled(): Promise<boolean> {
  return await hasFeature('ai_summary')
}

/**
 * AI 機能無効時に投げる専用エラー（既存コードとの互換のため残す）。
 * 内部的には `FeatureNotLicensedError('ai_summary')` と同等。
 */
export class AIFeatureDisabledError extends Error {
  constructor(message = 'AI 機能はご契約プランに含まれていません。営業窓口までお問い合わせください。') {
    super(message)
    this.name = 'AIFeatureDisabledError'
  }
}

/**
 * サーバー側ガード。Server Action 冒頭で呼び、無効なら AIFeatureDisabledError を throw。
 */
export async function ensureAIFeatureEnabled(): Promise<void> {
  try {
    await ensureFeature('ai_summary')
  } catch (e) {
    // license モジュールの例外型を AI 用にラップ
    if (e instanceof FeatureNotLicensedError) {
      throw new AIFeatureDisabledError(e.message)
    }
    if (e instanceof LicenseInactiveError) {
      throw new AIFeatureDisabledError(e.message)
    }
    throw e
  }
}
