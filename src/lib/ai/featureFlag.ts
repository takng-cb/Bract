/**
 * AI 機能の有効化フラグ。
 *
 * 設計方針:
 *   - AI 機能は追加料金（オプション機能）扱い
 *   - 環境変数 `AI_FEATURE_ENABLED` で制御（Vercel / .env.local で設定）
 *   - 顧客（CRM の admin）からは toggle できない（=DB ではなく env で管理）
 *   - 'true' / '1' / 'on' / 'yes' を有効と判定（大文字小文字無視）
 *   - 未設定 / 空文字 / その他の値はすべて無効扱い
 *
 * 影響範囲（無効時）:
 *   - サイドバーの「🤖 AI 設定」リンク非表示
 *   - 商談・物件詳細の「🤖 AI で活動をまとめる」ボタン非表示
 *   - /admin/ai ページにアクセスしても dashboard へリダイレクト
 *   - サーバーアクション summarizeOpportunity / summarizeProperty / updateAISettings /
 *     testAIConnection は AIFeatureDisabledError を throw
 *
 * NEXT_PUBLIC_ プレフィックスをつけないことで、フラグの真偽がクライアント
 * バンドルに混入することを防ぐ（Server Component / Server Action からのみ参照）。
 */

const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled'])

export function isAIFeatureEnabled(): boolean {
  const raw = process.env.AI_FEATURE_ENABLED
  if (!raw) return false
  return TRUTHY.has(raw.trim().toLowerCase())
}

/**
 * AI 機能無効時に投げる専用エラー。
 *
 * AIDisabledError (= API キー等が未設定) と区別することで、UI 側で
 * 「未契約」と「設定漏れ」を別メッセージにできる。
 */
export class AIFeatureDisabledError extends Error {
  constructor(message = 'AI 機能はご契約プランに含まれていません。営業窓口までお問い合わせください。') {
    super(message)
    this.name = 'AIFeatureDisabledError'
  }
}

/**
 * サーバー側ガード。Server Action 冒頭で呼び、無効ならエラーで早期終了。
 */
export function ensureAIFeatureEnabled(): void {
  if (!isAIFeatureEnabled()) throw new AIFeatureDisabledError()
}
