/**
 * env 変数の真偽値解析ユーティリティ (Issue #67)
 *
 * 機能フラグの env 変数（AI_FEATURE_ENABLED, LINE_FEATURE_ENABLED 等）を
 * パースする。
 *
 * 未設定 (undefined) と 設定済み (false) を区別するため、戻り値は:
 *   - true:  truthy 値（'true' / '1' / 'on' / 'yes' / 'enabled'）
 *   - false: それ以外の値（'false' / '0' / 'no' / 任意の文字列）
 *   - null:  env 変数が未設定 (undefined)
 *
 * null を返すことで「override なし → 他のロジック (DB 等) にフォールバック」を表現できる。
 */
const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled'])

export function parseEnvBool(raw: string | undefined): boolean | null {
  if (raw === undefined) return null
  return TRUTHY.has(raw.trim().toLowerCase())
}
