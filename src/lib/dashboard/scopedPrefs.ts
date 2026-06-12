/**
 * ダッシュボードウィジェット設定の scope 解決（#105）
 *
 * user_preferences.dashboard_widgets (jsonb) は歴史的に 2 形式が混在する:
 *
 *   1. 旧フラット形式（既存ユーザー）:
 *        { "<widgetId>": { enabled: boolean, order?: number }, ... }
 *      → グローバルダッシュボード (/dashboard) の設定として扱う（後方互換）
 *
 *   2. scoped 形式（本対応以降の保存はこちら）:
 *        {
 *          "global"?:        DashboardWidgetPrefs,   // /dashboard 用
 *          "module:<id>"?:   DashboardWidgetPrefs,   // /modules/<id> 用
 *        }
 *
 * scope キー（'global' / 'module:' 接頭辞）は予約語であり、widget id には使えない。
 * DB マイグレーションは行わず jsonb の中身だけで実現する。読み出しは両形式対応、
 * 書き込み時に scoped 形式へ移行する（既存のフラット設定は global に温存）。
 *
 * TODO(#105): 管理者によるモジュール既定（全員のデフォルト）は今回スコープ外。
 *             対応する場合は system 側の scoped prefs を user 側より弱い優先度でマージする。
 */
import type { DashboardWidgetPrefs } from './widgets'

/** グローバルダッシュボード (/dashboard) の scope キー */
export const WIDGET_PREFS_GLOBAL_SCOPE = 'global'

/** モジュール scope キーの接頭辞 */
export const WIDGET_PREFS_MODULE_PREFIX = 'module:'

/** モジュール ID → scope キー（例: 'auto-body' → 'module:auto-body'） */
export function moduleWidgetPrefsScope(moduleId: string): string {
  return `${WIDGET_PREFS_MODULE_PREFIX}${moduleId}`
}

/** scoped 形式の jsonb 全体の型 */
export type ScopedDashboardWidgetPrefs = {
  [scope: string]: DashboardWidgetPrefs
}

/**
 * jsonb の生値が scoped 形式かどうか判定する。
 * すべてのトップレベルキーが予約 scope キー（'global' / 'module:*'）なら scoped。
 * 空オブジェクトはどちらに解釈しても結果が同じためフラット扱いにする。
 */
export function isScopedWidgetPrefs(raw: unknown): raw is ScopedDashboardWidgetPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const keys = Object.keys(raw)
  if (keys.length === 0) return false
  return keys.every(
    (k) => k === WIDGET_PREFS_GLOBAL_SCOPE || k.startsWith(WIDGET_PREFS_MODULE_PREFIX),
  )
}

/**
 * jsonb の生値から指定 scope の設定を取り出す。
 * - scoped 形式: raw[scope]（無ければ null）
 * - 旧フラット形式: scope='global' のときだけ全体を返す（後方互換）。module scope は null
 * - null / 不正値: null
 */
export function resolveWidgetPrefsScope(
  raw: unknown,
  scope: string = WIDGET_PREFS_GLOBAL_SCOPE,
): DashboardWidgetPrefs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (Object.keys(raw).length === 0) return null   // 空オブジェクト＝設定なし
  if (isScopedWidgetPrefs(raw)) return raw[scope] ?? null
  // 旧フラット形式は global の設定として扱う
  return scope === WIDGET_PREFS_GLOBAL_SCOPE ? (raw as DashboardWidgetPrefs) : null
}

/**
 * 指定 scope の設定を書き込んだ scoped 形式の jsonb を作る（保存用）。
 * 旧フラット形式の生値は global キーへ移行してから上書きするため、
 * 既存ユーザーのグローバル設定を失わない。
 */
export function mergeWidgetPrefsScope(
  raw: unknown,
  scope: string,
  prefs: DashboardWidgetPrefs,
): ScopedDashboardWidgetPrefs {
  let base: ScopedDashboardWidgetPrefs = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (isScopedWidgetPrefs(raw)) {
      base = { ...raw }
    } else if (Object.keys(raw).length > 0) {
      // 旧フラット形式 → global へ移行
      base = { [WIDGET_PREFS_GLOBAL_SCOPE]: raw as DashboardWidgetPrefs }
    }
  }
  return { ...base, [scope]: prefs }
}
