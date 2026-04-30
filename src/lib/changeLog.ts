import { db } from '@/lib/db'
import { change_logs } from '@/lib/schema'

export type FieldSpec = {
  label: string
  value: string | number | null | undefined
}

type FieldMap = Record<string, FieldSpec>

/** 変更前後を比較して change_logs に記録 */
export async function logChanges(
  objectType: string,
  objectId: string,
  before: FieldMap,
  after: FieldMap,
) {
  const entries: (typeof change_logs.$inferInsert)[] = []

  for (const [key, { label, value: newVal }] of Object.entries(after)) {
    const oldVal  = before[key]?.value
    const newStr  = newVal != null ? String(newVal)  : null
    const oldStr  = oldVal != null ? String(oldVal) : null
    if (newStr === oldStr) continue

    entries.push({
      object_type: objectType,
      object_id:   objectId,
      field_name:  key,
      field_label: label,
      old_value:   oldStr,
      new_value:   newStr,
    })
  }

  if (entries.length > 0) {
    await db.insert(change_logs).values(entries)
  }
}

// ── 表示用ラベル変換 ─────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}
const STATUS_LABELS: Record<string, string> = { active: '有効', inactive: '無効' }

export function formatLogValue(fieldName: string, raw: string | null): string {
  if (raw == null) return '—'
  if (fieldName === 'stage')  return STAGE_LABELS[raw]  ?? raw
  if (fieldName === 'status') return STATUS_LABELS[raw] ?? raw
  if (fieldName === 'amount' || fieldName === 'annual_revenue') {
    const n = Number(raw)
    return isNaN(n) ? raw : `¥${n.toLocaleString()}`
  }
  return raw
}
