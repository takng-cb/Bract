/**
 * 活動種別 (activities.type) の管理。
 *
 * システム設定 (system_settings.activity_types) に JSON 配列で保存される。
 * 未設定の場合はデフォルトの 4 種別 (call/email/meeting/note) を使用。
 *
 * 設計判断: 活動種別はビルトインオブジェクト (activities) の「ピックリスト値」
 * に相当するため、book_definitions/book_fields ではなく専用の
 * system_settings キーで管理する（admin/objects ページでまとめて編集可）。
 */
import { db } from '@/lib/db'
import { system_settings } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export type ActivityType = {
  value: string
  label: string
  icon:  string
  /** UI バッジ色（Tailwind class）— optional */
  color?: string
}

const SETTING_KEY = 'activity_types'

export const DEFAULT_ACTIVITY_TYPES: ActivityType[] = [
  { value: 'call',    label: '電話',     icon: '📞', color: 'bg-info-bg text-info' },
  { value: 'email',   label: 'メール',   icon: '✉️', color: 'bg-ai-bg text-ai' },
  { value: 'meeting', label: '打合せ',   icon: '🤝', color: 'bg-positive-bg text-positive' },
  { value: 'note',    label: 'メモ',     icon: '📝', color: 'bg-n-100 text-n-600' },
]

/** 活動種別の現在値を取得（未設定時はデフォルト） */
export async function getActivityTypes(): Promise<ActivityType[]> {
  const rows = await db.select({ value: system_settings.value })
    .from(system_settings).where(eq(system_settings.key, SETTING_KEY))
  if (rows.length === 0) return DEFAULT_ACTIVITY_TYPES
  try {
    const parsed = JSON.parse(rows[0].value) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_ACTIVITY_TYPES
    const sanitized: ActivityType[] = []
    for (const item of parsed) {
      if (item && typeof item === 'object'
        && typeof (item as ActivityType).value === 'string'
        && typeof (item as ActivityType).label === 'string'
        && typeof (item as ActivityType).icon === 'string') {
        sanitized.push({
          value: (item as ActivityType).value,
          label: (item as ActivityType).label,
          icon:  (item as ActivityType).icon,
          color: typeof (item as ActivityType).color === 'string' ? (item as ActivityType).color : undefined,
        })
      }
    }
    return sanitized.length > 0 ? sanitized : DEFAULT_ACTIVITY_TYPES
  } catch {
    return DEFAULT_ACTIVITY_TYPES
  }
}

/** value → ActivityType の Map を作る（既知の値以外もフォールバック生成） */
export function indexActivityTypes(types: ActivityType[]): Record<string, ActivityType> {
  const map: Record<string, ActivityType> = {}
  for (const t of types) map[t.value] = t
  return map
}
