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

export const ASSIGNMENT_STATUSES = ['予約', '確定', '実施中', '完了', 'キャンセル'] as const
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number]

export const ASSIGNMENT_STAFF_STATUSES = ['予約', '確定', '実施', '完了', 'キャンセル'] as const
export type AssignmentStaffStatus = typeof ASSIGNMENT_STAFF_STATUSES[number]

// account の役割
export const ACCOUNT_ROLES = ['supplier', 'client', 'both'] as const
export type AccountRole = typeof ACCOUNT_ROLES[number]

export const ACCOUNT_ROLE_LABELS: Record<string, string> = {
  supplier: '人材会社',
  client:   '派遣先',
  both:     '両方',
}

// ── 色 ──────────────────────────────
export function staffStatusColor(status: string | null | undefined): string {
  switch (status) {
    case '稼働中':   return 'bg-green-50 text-green-700'
    case '一時休止': return 'bg-yellow-50 text-yellow-700'
    case '引退':     return 'bg-zinc-100 text-zinc-500'
    default:         return 'bg-zinc-50 text-zinc-700'
  }
}

export function assignmentStatusColor(status: string | null | undefined): string {
  switch (status) {
    case '予約':       return 'bg-blue-50 text-blue-700'
    case '確定':       return 'bg-cyan-50 text-cyan-700'
    case '実施中':     return 'bg-orange-50 text-orange-700'
    case '完了':       return 'bg-green-50 text-green-700'
    case 'キャンセル': return 'bg-zinc-100 text-zinc-500'
    default:           return 'bg-zinc-50 text-zinc-700'
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

// assignment_no 発番は assignmentNo.ts に分離 (DB 依存のため)
// 呼び出し側は @/industries/staffing/lib/assignmentNo から直接 import すること
