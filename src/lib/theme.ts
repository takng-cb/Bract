/**
 * ユーザーテーマ（カラープリセット＋ライト/ダーク）の共有定義（REQ-0079）。
 *
 * - サーバ／クライアント両方から import される純粋モジュール（DB/'use server' を含めない）。
 * - 実際の色は globals.css / theme-presets.css の `[data-theme="<key>"]` で定義。
 *   ここでは「選択肢の一覧」と「<html> への適用 / cookie 書き込み」ヘルパのみを持つ。
 * - FOUC を避けるため、初回適用は layout.tsx のインラインスクリプトが cookie から行う。
 *   この cookie のフォーマットは `${color}:${mode}`（例: 'blue:dark'）。
 */

export const THEME_COOKIE = 'bract_theme'

export type ThemeMode = 'light' | 'dark' | 'system'

export const DEFAULT_COLOR = 'green'
export const DEFAULT_MODE: ThemeMode = 'system'

export type ThemePreset = {
  key:   string
  label: string
  /** 設定 UI のスウォッチに使う代表色（おおむね brand-600） */
  swatch: string
}

/** カラープリセット。先頭 green が既定（data-theme 属性なし＝globals.css の素の brand）。 */
export const THEME_PRESETS: ThemePreset[] = [
  { key: 'green',  label: 'フォリッジ（既定）', swatch: 'oklch(0.535 0.074 148)' },
  { key: 'blue',   label: 'オーシャン',         swatch: 'oklch(0.540 0.165 255)' },
  { key: 'violet', label: 'バイオレット',       swatch: 'oklch(0.535 0.165 292)' },
  { key: 'rose',   label: 'ローズ',             swatch: 'oklch(0.555 0.170 14)'  },
  { key: 'amber',  label: 'アンバー',           swatch: 'oklch(0.580 0.150 55)'  },
  { key: 'teal',   label: 'ティール',           swatch: 'oklch(0.560 0.110 192)' },
]

export const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: 'light',  label: 'ライト' },
  { key: 'dark',   label: 'ダーク' },
  { key: 'system', label: 'OS に合わせる' },
]

export function isValidColor(c: string | null | undefined): boolean {
  return !!c && THEME_PRESETS.some((p) => p.key === c)
}

export function isValidMode(m: string | null | undefined): m is ThemeMode {
  return m === 'light' || m === 'dark' || m === 'system'
}

/** DB/cookie の生値を正規化して { color, mode } を返す。 */
export function normalizeTheme(
  color: string | null | undefined,
  mode: string | null | undefined,
): { color: string; mode: ThemeMode } {
  return {
    color: isValidColor(color) ? (color as string) : DEFAULT_COLOR,
    mode:  isValidMode(mode) ? mode : DEFAULT_MODE,
  }
}

/** cookie 文字列 'color:mode' を解析。 */
export function parseThemeCookie(raw: string | null | undefined): { color: string; mode: ThemeMode } {
  const [c, m] = (raw ?? '').split(':')
  return normalizeTheme(c, m)
}

/** cookie に格納する文字列を作る。 */
export function serializeTheme(color: string, mode: string): string {
  return `${color}:${mode}`
}

// ── クライアント専用ヘルパ（document 前提。SSR では no-op） ──────────────

/** <html> に data-theme と dark クラスを反映（即時プレビュー用）。 */
export function applyTheme(color: string, mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const c = isValidColor(color) ? color : DEFAULT_COLOR
  if (c !== DEFAULT_COLOR) root.setAttribute('data-theme', c)
  else root.removeAttribute('data-theme')
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}

/** テーマ cookie を 1 年で書き込む。 */
export function writeThemeCookie(color: string, mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(serializeTheme(color, mode))}; path=/; max-age=31536000; samesite=lax`
}
