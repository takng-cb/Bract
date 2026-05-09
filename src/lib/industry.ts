/**
 * Industry overlay 切り替え
 *
 * `NEXT_PUBLIC_INDUSTRY` 環境変数で動作する業種を選択する:
 *   - `base` (default): 業種非依存の汎用 CRM
 *   - `real-estate`: 不動産業特化（properties モジュール有効）
 *   - 将来の業種を追加する際は `src/industries/<name>/` を追加し
 *     この型と `INDUSTRIES` 定数に追加する。
 *
 * 業種固有のページは `src/app/(crm)/<route>/page.tsx` で `activeIndustry`
 * をチェックし、該当業種以外なら `notFound()` を返す。実体は
 * `src/industries/<industry>/pages/<route>/page.tsx` に dynamic import
 * で委譲する。
 */

export type Industry = 'base' | 'real-estate'

export const INDUSTRIES: readonly Industry[] = ['base', 'real-estate'] as const

/**
 * 現在ビルド/起動された業種。`base` がデフォルト。
 * 不正な値が指定された場合は安全側に `base` にフォールバック。
 */
export const activeIndustry: Industry = (() => {
  const v = process.env.NEXT_PUBLIC_INDUSTRY
  if (v && (INDUSTRIES as readonly string[]).includes(v)) return v as Industry
  return 'base'
})()

/** 指定業種が現在 active か */
export function isIndustry(industry: Industry): boolean {
  return activeIndustry === industry
}
