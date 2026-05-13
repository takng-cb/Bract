/**
 * ロール判定の純粋関数集。DB / Supabase / Drizzle に依存しない。
 *
 * Vitest でロジックを直接テストできるよう、`./db` を import せずに独立させる。
 * `./userRole.ts` (DB 連携) と `./auth.ts` (Supabase 連携) から呼ばれる。
 *
 * Issue #26 で導入。
 */

export type Role = 'admin' | 'editor' | 'viewer'

/** ロールが編集可能か（admin または editor）。null / 未知の値は false */
export function canEditRole(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'editor'
}

/** ロールが admin かどうか。null / 未知の値は false */
export function isAdminRole(role: Role | null | undefined): boolean {
  return role === 'admin'
}
