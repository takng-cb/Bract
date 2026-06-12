/**
 * モジュール別ダッシュボードのウィジェットレジストリのテスト（#105）
 */
import { describe, it, expect } from 'vitest'
import type { DashboardWidgetPrefs } from './widgets'
import {
  MODULE_WIDGETS,
  widgetsForModule,
  isModuleWidgetEnabled,
  sortedVisibleModuleWidgets,
} from './moduleWidgets'

describe('MODULE_WIDGETS', () => {
  it('全モジュール横断で widget id は重複しない', () => {
    const ids = Object.values(MODULE_WIDGETS).flat().map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('scope 予約キーと衝突する widget id が無い', () => {
    const ids = Object.values(MODULE_WIDGETS).flat().map((w) => w.id)
    for (const id of ids) {
      expect(id).not.toBe('global')
      expect(id.startsWith('module:')).toBe(false)
    }
  })

  it('auto-body は既存のグローバル定義（auto-body-*）を流用している', () => {
    const ids = widgetsForModule('auto-body').map((w) => w.id)
    expect(ids).toContain('auto-body-work-progress')
    expect(ids).toContain('auto-body-upcoming-inspections')
    expect(ids).toHaveLength(5)
  })
})

describe('widgetsForModule', () => {
  it('未定義のモジュールは空配列', () => {
    expect(widgetsForModule('does-not-exist')).toEqual([])
  })

  it('expenses / workspace は現状ウィジェット無し', () => {
    expect(widgetsForModule('expenses')).toEqual([])
    expect(widgetsForModule('workspace')).toEqual([])
  })
})

describe('isModuleWidgetEnabled', () => {
  it('未知の widget は false', () => {
    expect(isModuleWidgetEnabled('crm-core', 'does-not-exist', null)).toBe(false)
  })

  it('他モジュールの widget id を渡しても false', () => {
    expect(isModuleWidgetEnabled('crm-core', 'sales-counts', null)).toBe(false)
  })

  it('prefs が null なら defaultEnabled に従う', () => {
    expect(isModuleWidgetEnabled('crm-core', 'crm-core-counts', null)).toBe(true)
  })

  it('prefs で enabled=false を明示するとオフになる', () => {
    const prefs: DashboardWidgetPrefs = { 'crm-core-counts': { enabled: false } }
    expect(isModuleWidgetEnabled('crm-core', 'crm-core-counts', prefs)).toBe(false)
    // prefs に含まれていない widget はデフォルトに従う
    expect(isModuleWidgetEnabled('crm-core', 'crm-core-recent-records', prefs)).toBe(true)
  })
})

describe('sortedVisibleModuleWidgets', () => {
  it('disabled な widget は除外される', () => {
    const prefs: DashboardWidgetPrefs = { 'sales-counts': { enabled: false } }
    const ws = sortedVisibleModuleWidgets('sales', prefs)
    expect(ws.map((w) => w.id)).toEqual(['sales-closing-soon'])
  })

  it('order を上書きすると並び順が変わる', () => {
    const prefs: DashboardWidgetPrefs = {
      'sales-counts':       { enabled: true, order: 99 },  // 後ろに移動
      'sales-closing-soon': { enabled: true, order: 0 },   // 先頭に移動
    }
    const ws = sortedVisibleModuleWidgets('sales', prefs)
    expect(ws.map((w) => w.id)).toEqual(['sales-closing-soon', 'sales-counts'])
  })

  it('prefs 未設定なら defaultOrder 順で全件返る', () => {
    const ws = sortedVisibleModuleWidgets('auto-body', null)
    expect(ws.map((w) => w.id)).toEqual([
      'auto-body-work-progress',
      'auto-body-active-loaners',
      'auto-body-low-stock-parts',
      'auto-body-receivables',
      'auto-body-upcoming-inspections',
    ])
  })
})
