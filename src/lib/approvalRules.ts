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
/**
 * ステータス遷移トリガー（REQ-0037）。
 * レコードの field を from → to に変更しようとした時に承認を必須にする。
 * from / to が空・未指定なら「任意の値」にマッチ。
 */
export type ApprovalTransition = { field: string; from?: string; to?: string }
export type ApprovalRule = {
  /** 任意のルール名（設定 UI の表示用） */
  name?: string
  /** 指定があれば「ステータス遷移」トリガー。無ければ手動申請トリガー */
  transition?: ApprovalTransition
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
 * 設定とレコード値から「手動申請」の承認ルート（steps）を決定する。
 * ステータス遷移トリガーのルールは対象外（findTransitionRoute が扱う）。
 * 無効/ルール無し/マッチ無し/steps 空 → null（承認不要）。
 */
export function findRoute(config: ApprovalConfig | null, record: RecordValues): ApprovalStep[] | null {
  if (!config?.enabled) return null
  for (const rule of config.rules) {
    if (rule.transition) continue
    if (matchRule(rule, record)) {
      return rule.steps?.length ? rule.steps : null
    }
  }
  return null
}

/**
 * ステータス遷移（field: from → to）に承認が必要かを判定し、必要ならルートを返す。
 * 遷移ルールを上から評価し、field 一致＋from/to 一致（空=任意）＋when 条件で最初のマッチを採用。
 */
export function findTransitionRoute(
  config: ApprovalConfig | null,
  record: RecordValues,
  field: string,
  from: string,
  to: string,
): ApprovalStep[] | null {
  if (!config?.enabled) return null
  for (const rule of config.rules) {
    const t = rule.transition
    if (!t || t.field !== field) continue
    if (t.from && t.from !== from) continue
    if (t.to && t.to !== to) continue
    if (!matchRule(rule, record)) continue
    return rule.steps?.length ? rule.steps : null
  }
  return null
}

const SANITIZE_OPS: ApprovalOp[] = ['=', '!=', '>', '>=', '<', '<=', 'contains']

/**
 * 設定 UI から受け取った unknown 値を厳格に検証して ApprovalConfig にする（不正は null）。
 * approvers は 'user:<ref>' / 'role:<ref>' のみ許可。
 */
export function sanitizeApprovalConfig(raw: unknown): ApprovalConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.enabled !== 'boolean' || !Array.isArray(o.rules)) return null

  const rules: ApprovalRule[] = []
  for (const r of o.rules) {
    if (!r || typeof r !== 'object') return null
    const rr = r as Record<string, unknown>
    if (!Array.isArray(rr.steps) || rr.steps.length === 0) return null

    const steps: ApprovalStep[] = []
    for (const s of rr.steps) {
      const ss = s as { approvers?: unknown; mode?: unknown }
      if (!Array.isArray(ss.approvers) || ss.approvers.length === 0) return null
      const approvers = ss.approvers.filter(
        (a): a is string => typeof a === 'string' && (/^user:.+/.test(a) || /^role:.+/.test(a)),
      )
      if (approvers.length !== ss.approvers.length) return null
      steps.push({ approvers, mode: ss.mode === 'all' ? 'all' : 'any' })
    }

    const rule: ApprovalRule = { steps }
    if (typeof rr.name === 'string' && rr.name.trim()) rule.name = rr.name.trim()

    if (rr.transition && typeof rr.transition === 'object') {
      const t = rr.transition as Record<string, unknown>
      if (typeof t.field !== 'string' || !t.field.trim()) return null
      rule.transition = {
        field: t.field.trim(),
        ...(typeof t.from === 'string' && t.from.trim() ? { from: t.from.trim() } : {}),
        ...(typeof t.to === 'string' && t.to.trim() ? { to: t.to.trim() } : {}),
      }
    }

    if (rr.when && typeof rr.when === 'object') {
      const w = rr.when as Record<string, unknown>
      const parseConds = (arr: unknown): ApprovalCondition[] | null => {
        if (!Array.isArray(arr)) return null
        const out: ApprovalCondition[] = []
        for (const c of arr) {
          const cc = c as { field?: unknown; op?: unknown; value?: unknown }
          if (typeof cc.field !== 'string' || !cc.field.trim()) return null
          if (!SANITIZE_OPS.includes(cc.op as ApprovalOp)) return null
          if (typeof cc.value !== 'string') return null
          out.push({ field: cc.field.trim(), op: cc.op as ApprovalOp, value: cc.value })
        }
        return out
      }
      const when: ApprovalRule['when'] = {}
      if (w.all !== undefined) {
        const all = parseConds(w.all)
        if (all === null) return null
        if (all.length) when.all = all
      }
      if (w.any !== undefined) {
        const any = parseConds(w.any)
        if (any === null) return null
        if (any.length) when.any = any
      }
      if (when.all || when.any) rule.when = when
    }

    rules.push(rule)
  }
  return { enabled: o.enabled, rules }
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
