/**
 * モジュール別ダッシュボード（/modules/<id>）のウィジェット定義（#105）
 *
 * グローバルダッシュボード用の DASHBOARD_WIDGETS（widgets.ts）と対になる、
 * モジュールホーム用のレジストリ。設定はユーザー単位
 * (user_preferences.dashboard_widgets jsonb の scope 'module:<id>'、scopedPrefs.ts 参照)。
 *
 * 追加するときは該当モジュールの配列に 1 行足し、
 * src/components/dashboard/<Module>Widgets.tsx でセクションを括る。
 *
 * TODO(#105): 管理者によるモジュール既定（全員のデフォルト）は今回スコープ外。
 */
import { DASHBOARD_WIDGETS, type WidgetMeta, type DashboardWidgetPrefs } from './widgets'

/**
 * モジュール ID → ウィジェット定義。
 * industries はモジュール有効判定（isModuleEnabled）側で制御済みのため常に 'all'。
 * auto-body は /dashboard 時代からの既存 id（auto-body-*）を流用し、定義も
 * DASHBOARD_WIDGETS と共有する（二重管理を避ける）。
 */
export const MODULE_WIDGETS: Record<string, WidgetMeta[]> = {
  'crm-core': [
    {
      id:           'crm-core-counts',
      title:        '件数カード',
      description:  '取引先・人物の件数 (2 枚)',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 0,
    },
    {
      id:           'crm-core-recent-records',
      title:        '最近更新されたレコード',
      description:  '取引先・人物のうち最近更新されたものを最大 8 件',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 10,
    },
  ],
  'sales': [
    {
      id:           'sales-counts',
      title:        '件数カード',
      description:  '進行中の商談・30日内クローズ予定の件数 (2 枚)',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 0,
    },
    {
      id:           'sales-closing-soon',
      title:        '期限が近い商談',
      description:  '今後30日にクローズ予定の商談リスト',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 10,
    },
  ],
  'inventory': [
    {
      id:           'inventory-counts',
      title:        '件数カード',
      description:  '商品・倉庫の件数 (2 枚)',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 0,
    },
    {
      id:           'inventory-recent-movements',
      title:        '最近の入出庫',
      description:  '最近の在庫移動を最大 12 件',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 10,
    },
  ],
  'real-estate': [
    {
      id:           'real-estate-counts',
      title:        '件数カード',
      description:  '物件・募集中の件数 (2 枚)',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 0,
    },
    {
      id:           'real-estate-recent-properties',
      title:        '最近更新された物件',
      description:  '最近更新された物件を最大 8 件',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 10,
    },
  ],
  'staffing': [
    {
      id:           'staffing-counts',
      title:        '件数カード',
      description:  '案件・稼働中スタッフの件数 (2 枚)',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 0,
    },
    {
      id:           'staffing-upcoming-assignments',
      title:        '今後の業務日',
      description:  '業務日が今後に設定された案件を最大 12 件',
      industries:   'all',
      defaultEnabled: true,
      defaultOrder: 10,
    },
  ],
  // auto-body は既存のグローバル定義（auto-body-*）をそのまま流用
  'auto-body': DASHBOARD_WIDGETS.filter(
    (w) => w.industries !== 'all' && w.industries.includes('auto-body'),
  ),
  // expenses / workspace は現状ウィジェット無し（追加時にここへ定義）
  'expenses': [],
  'workspace': [],
}

/** 指定モジュールのウィジェット一覧（未定義モジュールは空配列） */
export function widgetsForModule(moduleId: string): WidgetMeta[] {
  return MODULE_WIDGETS[moduleId] ?? []
}

/**
 * モジュールウィジェットが現ユーザーで有効か判定。
 * 設定が無い場合は widget の defaultEnabled に従う（widgets.ts の isWidgetEnabled と同じ規則）。
 */
export function isModuleWidgetEnabled(
  moduleId: string,
  widgetId: string,
  prefs: DashboardWidgetPrefs | null | undefined,
): boolean {
  const w = widgetsForModule(moduleId).find((x) => x.id === widgetId)
  if (!w) return false
  const cfg = prefs?.[widgetId]
  if (cfg === undefined) return w.defaultEnabled
  return cfg.enabled
}

/**
 * 指定モジュールの表示対象ウィジェットを、ユーザーの並び順設定を反映してソートして返す。
 * order 未指定のものは defaultOrder で並ぶ。
 */
export function sortedVisibleModuleWidgets(
  moduleId: string,
  prefs: DashboardWidgetPrefs | null | undefined,
): WidgetMeta[] {
  return widgetsForModule(moduleId)
    .filter((w) => isModuleWidgetEnabled(moduleId, w.id, prefs))
    .sort((a, b) => {
      const ao = prefs?.[a.id]?.order ?? a.defaultOrder
      const bo = prefs?.[b.id]?.order ?? b.defaultOrder
      return ao - bo
    })
}
