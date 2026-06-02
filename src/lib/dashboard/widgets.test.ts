/**
 * ダッシュボードウィジェットレジストリのテスト (ベース機能)
 */
import { describe, it, expect } from 'vitest'
import {
  DASHBOARD_WIDGETS,
  widgetsForIndustry,
  isWidgetEnabled,
  sortedVisibleWidgets,
  type DashboardWidgetPrefs,
} from './widgets'

describe('DASHBOARD_WIDGETS', () => {
  it('全 widget の id は重複しない', () => {
    const ids = DASHBOARD_WIDGETS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('widgetsForIndustry', () => {
  it('base 業種では all のみ返る', () => {
    const ws = widgetsForIndustry('base')
    expect(ws.every((w) => w.industries === 'all')).toBe(true)
  })

  it('auto-body 業種では all + auto-body のものが含まれる', () => {
    const ws = widgetsForIndustry('auto-body')
    expect(ws.some((w) => w.id === 'auto-body-work-progress')).toBe(true)
    expect(ws.some((w) => w.id === 'kpi-cards')).toBe(true)
  })

  it('real-estate 業種では auto-body 専用 widget は含まれない', () => {
    const ws = widgetsForIndustry('real-estate')
    expect(ws.some((w) => w.id === 'auto-body-work-progress')).toBe(false)
    expect(ws.some((w) => w.id === 'kpi-cards')).toBe(true)
  })
})

describe('isWidgetEnabled', () => {
  it('未知の widget は false', () => {
    expect(isWidgetEnabled('does-not-exist', null)).toBe(false)
  })

  it('prefs が null なら defaultEnabled に従う', () => {
    // 既存 widget は全て defaultEnabled: true 設定なので true
    expect(isWidgetEnabled('kpi-cards', null)).toBe(true)
  })

  it('prefs で enabled=false を明示するとオフになる', () => {
    const prefs: DashboardWidgetPrefs = { 'kpi-cards': { enabled: false } }
    expect(isWidgetEnabled('kpi-cards', prefs)).toBe(false)
  })

  it('prefs に含まれていない widget はデフォルトに従う', () => {
    const prefs: DashboardWidgetPrefs = { 'kpi-cards': { enabled: false } }
    expect(isWidgetEnabled('period-tasks', prefs)).toBe(true)
  })
})

describe('sortedVisibleWidgets', () => {
  it('disabled な widget は除外される', () => {
    const prefs: DashboardWidgetPrefs = { 'kpi-cards': { enabled: false } }
    const ws = sortedVisibleWidgets('base', prefs)
    expect(ws.some((w) => w.id === 'kpi-cards')).toBe(false)
  })

  it('order を上書きすると並び順が変わる', () => {
    const prefs: DashboardWidgetPrefs = {
      'kpi-cards':           { enabled: true, order: 99 },  // 後ろに移動
      'recent-records':      { enabled: true, order: 0 },   // 先頭に移動
      'period-tasks':        { enabled: true },
      'period-opportunities':{ enabled: true },
      'period-activities':   { enabled: true },
    }
    const ws = sortedVisibleWidgets('base', prefs)
    expect(ws[0].id).toBe('recent-records')
    expect(ws[ws.length - 1].id).toBe('kpi-cards')
  })
})
