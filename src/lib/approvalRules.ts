/**
 * レコード承認 — ルール評価の純関数（REQ-0023 / ADR-0022 / #85）
 *
 * 設定（system_settings `approval_config:<book_api>` の JSON）:
 *   { enabled: true, rules: [ { when: { all|any: [条件…] }, steps: [ { approvers, mode } … ] } … ] }
 * - rules は上から評価し、最初にマッチしたルートを採用。マッチ無し＝承認不要。
 * - when 省略＝無条件マッチ（全件承認）。
 * - approvers の要素は 'user:<uuid>' または 'role:<ロール名>'。
 * - mode: 'any'=ステップ内の誰か1承認で次へ / 'all'=全 approver エントリの承認で次へ。
 *
 * DB アクセスなし（client/server/test から import 可）。
 */

export type ApprovalOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains'

export type ApprovalCondition = { field: string; op: ApprovalOp; value: string }
export type ApprovalStep = { approvers: string[]; mode: 'any' | 'all' }
export type ApprovalRule = {
  when?: { all?: ApprovalCondition[]; any?: ApprovalCondition[] }
  steps: ApprovalStep[]
}
export type ApprovalConfig = { enabled: boolean; rules: ApprovalRule[] }

export type RecordValues = Record<string, unknown>

/** 保存 JSON 文字列を ApprovalConfig にパース（不正は null） */
export function parseApprovalConfig(raw: string | null | undefined): ApprovalConfig | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && typeof p.enabled === 'boolean' && Array.isArray(p.rules)) {
      return { enabled: p.enabled, rules: p.rules }
    }
  } catch { /* fall through */ }
  return null
}

/** 単一条件の評価。数値比較は両辺が数値化できる場合のみ、それ以外は文字列比較 */
export function evaluateCondition(cond: ApprovalCondition, record: RecordValues): boolean {
  const raw = record[cond.field]
  if (raw === undefined || raw === null) return false
  const lhsNum = Number(raw)
  const rhsNum = Number(cond.value)
  const numeric = String(raw).trim() !== '' && Number.isFinite(lhsNum) && cond.value.trim() !== '' && Number.isFinite(rhsNum)

  switch (cond.op) {
    case '=':  return numeric ? lhsNum === rhsNum : String(raw) === cond.value
    case '!=': return numeric ? lhsNum !== rhsNum : String(raw) !== cond.value
    case '>':  return numeric && lhsNum >  rhsNum
    case '>=': return numeric && lhsNum >= rhsNum
    case '<':  return numeric && lhsNum <  rhsNum
    case '<=': return numeric && lhsNum <= rhsNum
    case 'contains': return String(raw).includes(cond.value)
    default: return false
  }
}

/** ルールの when 評価（when 省略＝マッチ） */
export function matchRule(rule: ApprovalRule, record: RecordValues): boolean {
  const w = rule.when
  if (!w || (!w.all?.length && !w.any?.length)) return true
  if (w.all?.length && !w.all.every((c) => evaluateCondition(c, record))) return false
  if (w.any?.length && !w.any.some((c) => evaluateCondition(c, record))) return false
  return true
}

/**
 * 設定とレコード値から承認ルート（steps）を決定する。
 * 無効/ルール無し/マッチ無し/steps 空 → null（承認不要）。
 */
export function findRoute(config: ApprovalConfig | null, record: RecordValues): ApprovalStep[] | null {
  if (!config?.enabled) return null
  for (const rule of config.rules) {
    if (matchRule(rule, record)) {
      return rule.steps?.length ? rule.steps : null
    }
  }
  return null
}

export type DecisionLite = { step: number; approver_id: string; decision: string }

/** approver エントリ（'user:<id>' | 'role:<name>'）が判定者に合致するか */
export function approverMatches(entry: string, userId: string, roleName: string): boolean {
  if (entry === `user:${userId}`) return true
  if (entry === `role:${roleName}`) return true
  return false
}

/** 指定ユーザーが現在 step の承認者か（既に同 step で判定済みなら false） */
export function canDecideStep(
  step: ApprovalStep,
  stepNo: number,
  decisions: DecisionLite[],
  userId: string,
  roleName: string,
): boolean {
  if (!step.approvers.some((a) => approverMatches(a, userId, roleName))) return false
  return !decisions.some((d) => d.step === stepNo && d.approver_id === userId)
}

/**
 * 当該 step が承認完了したか。
 * - mode 'any': その step に approved が1件以上。
 * - mode 'all': 全 approver エントリそれぞれについて、合致する approved が存在する。
 *   （'role:<name>' エントリは、そのロールの誰か1人の承認で当該エントリを満たす。
 *    判定者のロールは判定時点のものを decisions 側で保証できないため、
 *    server 層が decision 挿入時に approver 合致を検証する前提）
 */
export function isStepSatisfied(
  step: ApprovalStep,
  stepNo: number,
  decisions: DecisionLite[],
  /** approver_id → そのユーザーのロール名（mode 'all' の role エントリ判定用） */
  rolesByUser: Record<string, string>,
): boolean {
  const approved = decisions.filter((d) => d.step === stepNo && d.decision === 'approved')
  if (approved.length === 0) return false
  if (step.mode === 'any') return true
  return step.approvers.every((entry) =>
    approved.some((d) => approverMatches(entry, d.approver_id, rolesByUser[d.approver_id] ?? '')),
  )
}
