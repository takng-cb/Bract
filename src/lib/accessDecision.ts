/**
 * アクセス制御の「純粋な判定ロジック」（REQ-0083/0084 / ADR-0029）。
 *
 * DB / Supabase / server-only に依存させず、Vitest で直接テストできるよう独立させる
 * （role.ts と同じ方針）。permissions.ts / recordGrants.ts はここを呼んで本番判定する
 * ＝テストが本番経路を覆う。
 */

/** レコードスコープ。'all'=全件 / 'own'=owner_id が自分のみ（将来 'team'）。 */
export type RecordScope = 'all' | 'own'

/** 任意文字列を安全に RecordScope へ正規化（不正値・null は 'all'）。 */
export function normScope(v: string | null | undefined): RecordScope {
  return v === 'own' ? 'own' : 'all'
}

/** op に応じて read/write どちらのスコープを使うか選ぶ。read 以外（create/update/delete）は write。 */
export function pickScope(readScope: RecordScope, writeScope: RecordScope, op: 'read' | 'create' | 'update' | 'delete'): RecordScope {
  return op === 'read' ? readScope : writeScope
}

/**
 * 単一レコードへのアクセス可否（層1 ブックCRUD ∧ 層2 レコードスコープ）の純粋判定。
 * - isAdmin: 常に許可
 * - canOp: 層1（そのブック・操作のブック権限）。false なら拒否
 * - scope='all': owner を問わず許可 / 'own': owner が自分のときのみ許可
 */
export function canAccessRecord(params: {
  isAdmin: boolean
  canOp: boolean
  scope: RecordScope
  ownerId: string | null
  meId: string | null
}): boolean {
  const { isAdmin, canOp, scope, ownerId, meId } = params
  if (isAdmin) return true
  if (!canOp) return false
  if (scope === 'all') return true
  return !!meId && ownerId === meId
}

/**
 * record_grants の有効判定（純粋）。expires_at が無い、または nowMs より未来なら有効。
 * （本番の一覧/可視判定は SQL 述語で行うが、JS 側チェックや将来用途のために純粋版を用意し検証する）
 */
export function isGrantActive(expiresAt: Date | string | number | null | undefined, nowMs: number): boolean {
  if (expiresAt == null || expiresAt === '') return true
  const exp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  if (Number.isNaN(exp)) return true
  return exp > nowMs
}
