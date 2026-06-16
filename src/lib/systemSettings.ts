import { cache } from 'react'
import { db } from '@/lib/db'
import { system_settings } from '@/lib/schema'
import { inArray } from 'drizzle-orm'
import { DEFAULT_TIMEZONE, isValidTimeZone } from '@/lib/datetime'

// ----------------------------------------------------------------
// 設定キーとデフォルト値
// ----------------------------------------------------------------
export const SYSTEM_DEFAULTS = {
  company_name:             'Bract',
  nav_order:                '',
  password_min_length:      '8',
  session_timeout_minutes:  '0',   // 0 = タイムアウトなし
  allow_self_registration:  'false',
  fiscal_year_start:        '4',   // 月（1-12）
  // 商談の「商品」セクションで紐付け先にできるブック（JSON 配列の book api。REQ-0034）
  opportunity_product_books: '["products","parts"]',
  // モバイル下部タブ（JSON 配列の href ×4。中央 FAB は固定。REQ-0041）
  mobile_bottom_nav: '["/dashboard","/accounts","/tasks","/activities"]',
  // ボードの終端ステータス列（受注/失注/完了）を直近Nヶ月に絞る。'0' = 無制限（REQ-0044）
  board_closed_window_months: '3',
  // ゴミ箱の保持日数（過ぎると自動で完全削除。REQ-0047）
  trash_retention_days: '30',
  // 表示タイムゾーン（IANA 名。日時の表示整形に使う。サーバ描画が UTC で出る問題対策。REQ-0081）
  timezone: 'Asia/Tokyo',
} as const

export type SystemSettingKey = keyof typeof SYSTEM_DEFAULTS

// ----------------------------------------------------------------
// 複数のシステム設定を一括取得
// ----------------------------------------------------------------
export async function getSystemSettings(
  keys: SystemSettingKey[]
): Promise<Record<SystemSettingKey, string>> {
  const result = Object.fromEntries(
    keys.map((k) => [k, SYSTEM_DEFAULTS[k]])
  ) as Record<SystemSettingKey, string>

  try {
    const rows = await db.select()
      .from(system_settings)
      .where(inArray(system_settings.key, keys as string[]))
    for (const row of rows) {
      result[row.key as SystemSettingKey] = row.value
    }
  } catch {
    // DB エラー時はデフォルト値で継続
  }

  return result
}

// ----------------------------------------------------------------
// 単一のシステム設定を取得
// ----------------------------------------------------------------
export async function getSystemSetting(key: SystemSettingKey): Promise<string> {
  const result = await getSystemSettings([key])
  return result[key]
}

// ----------------------------------------------------------------
// 表示タイムゾーン（REQ-0081）。サーバコンポーネントの日時整形で使う。
// リクエスト内メモ化（react cache）。不正値は既定 Asia/Tokyo にフォールバック。
// ----------------------------------------------------------------
export const getAppTimeZone = cache(async (): Promise<string> => {
  const tz = await getSystemSetting('timezone')
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE
})
