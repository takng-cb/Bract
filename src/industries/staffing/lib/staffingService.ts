/**
 * staffing 業種の業務ロジック — 純粋関数のみ (Issue #69)
 *
 * DB 依存のある関数 (generateAssignmentNo 等) は assignmentNo.ts に分離。
 *
 * - スタッフ・案件ステータス定数
 * - 粗利計算
 * - 色判定
 */

// ── ステータス定数 ──────────────────────────────
export const STAFF_STATUSES = ['稼働中', '一時休止', '引退'] as const
export type StaffStatus = typeof STAFF_STATUSES[number]

// 案件ステータス（業務フロー：受付 → 打診中 → 候補集約 → 確定 → 実施 → 完了。spec §3）
// 旧データ（予約/実施中）も色判定で吸収する。
export const ASSIGNMENT_STATUSES = ['受付', '打診中', '候補集約', '確定', '実施', '完了', 'キャンセル'] as const
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number]

export const ASSIGNMENT_STAFF_STATUSES = ['予約', '確定', '実施', '完了', 'キャンセル'] as const
export type AssignmentStaffStatus = typeof ASSIGNMENT_STAFF_STATUSES[number]

// 打診(RFQ)ステータス（spec §4 outreach）
export const OUTREACH_STATUSES = ['打診済', '返信待ち', '候補あり', '該当なし'] as const
export type OutreachStatus = typeof OUTREACH_STATUSES[number]

// 候補(assignment_staff.candidate_status)
export const CANDIDATE_STATUSES = ['候補', '確定', '辞退'] as const
export type CandidateStatus = typeof CANDIDATE_STATUSES[number]

// account の役割
export const ACCOUNT_ROLES = ['supplier', 'client', 'both'] as const
export type AccountRole = typeof ACCOUNT_ROLES[number]

export const ACCOUNT_ROLE_LABELS: Record<string, string> = {
  supplier: '人材会社',
  client:   '派遣先',
  both:     '両方',
}

// ── 色（semantic tone トークンで統一。ADR-0021） ──────────────────────
// neutral=bg-n-100 text-n-600 / brand=bg-brand-50 text-brand-700 / 他=bg-{tone}-bg text-{tone}
export function staffStatusColor(status: string | null | undefined): string {
  switch (status) {
    case '稼働中':   return 'bg-positive-bg text-positive'
    case '一時休止': return 'bg-warning-bg text-warning'
    case '引退':     return 'bg-n-100 text-n-600'
    default:         return 'bg-n-100 text-n-600'
  }
}

export function assignmentStatusColor(status: string | null | undefined): string {
  switch (status) {
    case '受付':
    case '予約':       return 'bg-n-100 text-n-600'
    case '打診中':     return 'bg-ai-bg text-ai'
    case '候補集約':   return 'bg-warning-bg text-warning'
    case '確定':       return 'bg-brand-50 text-brand-700'
    case '実施':
    case '実施中':     return 'bg-info-bg text-info'
    case '完了':       return 'bg-positive-bg text-positive'
    case 'キャンセル': return 'bg-n-100 text-n-600'
    default:           return 'bg-n-100 text-n-600'
  }
}

export function outreachStatusColor(status: string | null | undefined): string {
  switch (status) {
    case '打診済':   return 'bg-info-bg text-info'
    case '返信待ち': return 'bg-warning-bg text-warning'
    case '候補あり': return 'bg-positive-bg text-positive'
    case '該当なし': return 'bg-n-100 text-n-600'
    default:         return 'bg-n-100 text-n-600'
  }
}

export function candidateStatusColor(status: string | null | undefined): string {
  switch (status) {
    case '確定': return 'bg-brand-50 text-brand-700'
    case '辞退': return 'bg-n-100 text-n-600'
    case '候補': return 'bg-warning-bg text-warning'
    default:     return 'bg-n-100 text-n-600'
  }
}

// ── 粗利計算 ──────────────────────────────
type AssignmentStaffEntry = {
  service_hours?: number | string | null
  hourly_rate?:   number | string | null
  cost_per_hour?: number | string | null
}

/**
 * 案件粗利 = client_total_fee − Σ (cost_per_hour × service_hours)
 *
 * client_total_fee が NULL なら assignment_staff の hourly_rate × hours の合計を
 * 売上として使う (fallback)。
 */
export function calcAssignmentProfit(
  clientTotalFee: number | string | null | undefined,
  staffEntries: AssignmentStaffEntry[],
): { revenue: number; cost: number; profit: number } {
  let cost    = 0
  let fallbackRevenue = 0
  for (const e of staffEntries) {
    const h    = Number(e.service_hours ?? 0)
    const rate = Number(e.hourly_rate ?? 0)
    const cph  = Number(e.cost_per_hour ?? 0)
    if (Number.isFinite(h) && Number.isFinite(cph)) cost += h * cph
    if (Number.isFinite(h) && Number.isFinite(rate)) fallbackRevenue += h * rate
  }
  const revenue = (clientTotalFee != null && Number(clientTotalFee) > 0)
    ? Number(clientTotalFee)
    : fallbackRevenue
  return { revenue, cost, profit: revenue - cost }
}

/**
 * 固定単価モデルの粗利（ADR-0010）。
 * 売上＝発注単価(client_total_fee)、仕入＝確定候補の提示単価(proposed_rate)合計、粗利＝売上−仕入。
 * 「確定」候補のみを仕入に算入する。
 */
export function calcMarginFixed(
  clientTotalFee: number | string | null | undefined,
  candidates: { proposed_rate?: number | string | null; candidate_status?: string | null }[],
): { revenue: number; cost: number; margin: number; confirmedCount: number } {
  const revenue = clientTotalFee != null && Number(clientTotalFee) > 0 ? Number(clientTotalFee) : 0
  let cost = 0
  let confirmedCount = 0
  for (const c of candidates) {
    if (c.candidate_status !== '確定') continue
    confirmedCount += 1
    const p = Number(c.proposed_rate ?? 0)
    if (Number.isFinite(p)) cost += p
  }
  return { revenue, cost, margin: revenue - cost, confirmedCount }
}

// assignment_no 発番は assignmentNo.ts に分離 (DB 依存のため)
// 呼び出し側は @/industries/staffing/lib/assignmentNo から直接 import すること
