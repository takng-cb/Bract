/**
 * ダッシュボードウィジェットの定義 (ベース機能)
 *
 * 各ウィジェットは:
 *   - id:      一意識別子 (DB に保存される)
 *   - title:   設定 UI で表示するタイトル
 *   - description: 説明文
 *   - industries:  どの業種で利用可能か (全業種なら 'all')
 *   - defaultEnabled: 未設定ユーザーのデフォルト表示
 *
 * 設定はユーザー単位 (user_preferences.dashboard_widgets jsonb)。
 * 形式: { "widget_id": { enabled: boolean, order: number } }
 *
 * 追加するときはここに 1 行足し、dashboard/page.tsx で
 * isWidgetEnabled('widget-id', prefs) ガードで括る。
 */
import type { Industry } from '@/lib/industry'

export type WidgetMeta = {
  id:             string
  title:          string
  description:    string
  industries:     'all' | Industry[]   // 全業種 or 限定
  defaultEnabled: boolean
  defaultOrder:   number               // 0=上位
}

/** 全ウィジェット定義 */
export const DASHBOARD_WIDGETS: WidgetMeta[] = [
  // ── 共通 (KPI と基本ウィジェット) ──
  {
    id:           'kpi-cards',
    title:        'KPI カード',
    description:  'アクティブな取引先・期間内 ToDo・商談・想定売上 (4 枚)',
    industries:   'all',
    defaultEnabled: true,
    defaultOrder: 0,
  },
  {
    id:           'period-tasks',
    title:        '期間内の ToDo',
    description:  '期限が期間内・未完了の ToDo リスト',
    industries:   'all',
    defaultEnabled: true,
    defaultOrder: 10,
  },
  {
    id:           'period-opportunities',
    title:        '期間内の商談',
    description:  '完了予定日が期間内の商談リスト',
    industries:   'all',
    defaultEnabled: true,
    defaultOrder: 20,
  },
  {
    id:           'period-activities',
    title:        '期間内の活動',
    description:  '実施日が期間内の活動記録',
    industries:   'all',
    defaultEnabled: true,
    defaultOrder: 30,
  },
  {
    id:           'recent-records',
    title:        '最近更新されたレコード',
    description:  '取引先・人物・商談のうち最近更新されたものを最大 8 件',
    industries:   'all',
    defaultEnabled: true,
    defaultOrder: 80,
  },

  // ── auto-body 専用 ──
  {
    id:           'auto-body-work-progress',
    title:        '📊 作業進行状況',
    description:  '整備の状態別件数 (予約/受付/作業中/部品待ち/納車待ち/完了)',
    industries:   ['auto-body'],
    defaultEnabled: true,
    defaultOrder: 5,
  },
  {
    id:           'auto-body-active-loaners',
    title:        '🚙 代車中の車両',
    description:  '現在貸出中の代車一覧',
    industries:   ['auto-body'],
    defaultEnabled: true,
    defaultOrder: 40,
  },
  {
    id:           'auto-body-low-stock-parts',
    title:        '🔧 要発注の部品',
    description:  '在庫が発注しきい値を下回っている部品リスト',
    industries:   ['auto-body'],
    defaultEnabled: true,
    defaultOrder: 50,
  },
  {
    id:           'auto-body-receivables',
    title:        '💰 未入金の整備',
    description:  '請求済みで入金が完了していない整備の合計と件数',
    industries:   ['auto-body'],
    defaultEnabled: true,
    defaultOrder: 60,
  },
  {
    id:           'auto-body-upcoming-inspections',
    title:        '🚗 車検期限アラート',
    description:  '30 日以内 / 期限超過の車両を表示',
    industries:   ['auto-body'],
    defaultEnabled: true,
    defaultOrder: 70,
  },
]

/**
 * 現在の業種で表示可能なウィジェット一覧。
 */
export function widgetsForIndustry(industry: Industry): WidgetMeta[] {
  return DASHBOARD_WIDGETS.filter((w) =>
    w.industries === 'all' || w.industries.includes(industry),
  )
}

/**
 * ユーザー設定 jsonb の型。
 * 未設定なら null。
 */
export type DashboardWidgetPrefs = {
  [widgetId: string]: { enabled: boolean; order?: number }
}

/**
 * ウィジェットが現ユーザーで有効か判定。
 * 設定が無い場合は widget の defaultEnabled に従う。
 */
export function isWidgetEnabled(
  widgetId: string,
  prefs: DashboardWidgetPrefs | null | undefined,
): boolean {
  const w = DASHBOARD_WIDGETS.find((x) => x.id === widgetId)
  if (!w) return false
  if (!prefs) return w.defaultEnabled
  const cfg = prefs[widgetId]
  if (cfg === undefined) return w.defaultEnabled
  return cfg.enabled
}

/**
 * 現在の業種で表示可能なウィジェット一覧を、ユーザーの並び順設定を反映してソートする。
 * ユーザーが order を指定していないものは defaultOrder で並ぶ。
 */
export function sortedVisibleWidgets(
  industry: Industry,
  prefs: DashboardWidgetPrefs | null | undefined,
): WidgetMeta[] {
  return widgetsForIndustry(industry)
    .filter((w) => isWidgetEnabled(w.id, prefs))
    .sort((a, b) => {
      const ao = prefs?.[a.id]?.order ?? a.defaultOrder
      const bo = prefs?.[b.id]?.order ?? b.defaultOrder
      return ao - bo
    })
}
