/**
 * ダッシュボードウィジェット設定の scope 解決のテスト（#105）
 *
 * 後方互換（旧フラット形式 → global 扱い）と、module scope の分離・マージを検証する。
 */
import { describe, it, expect } from 'vitest'
import type { DashboardWidgetPrefs } from './widgets'
import {
  WIDGET_PREFS_GLOBAL_SCOPE,
  moduleWidgetPrefsScope,
  isScopedWidgetPrefs,
  resolveWidgetPrefsScope,
  mergeWidgetPrefsScope,
} from './scopedPrefs'

const flat: DashboardWidgetPrefs = {
  'kpi-cards':      { enabled: false },
  'period-tasks':   { enabled: true, order: 3 },
}

const modulePrefs: DashboardWidgetPrefs = {
  'auto-body-work-progress': { enabled: false },
}

describe('moduleWidgetPrefsScope', () => {
  it('module: 接頭辞付きの scope キーを返す', () => {
    expect(moduleWidgetPrefsScope('auto-body')).toBe('module:auto-body')
  })
})

describe('isScopedWidgetPrefs', () => {
  it('旧フラット形式は scoped ではない', () => {
    expect(isScopedWidgetPrefs(flat)).toBe(false)
  })

  it('global / module:* キーのみなら scoped', () => {
    expect(isScopedWidgetPrefs({ global: flat })).toBe(true)
    expect(isScopedWidgetPrefs({ 'module:auto-body': modulePrefs })).toBe(true)
    expect(isScopedWidgetPrefs({ global: flat, 'module:sales': {} })).toBe(true)
  })

  it('予約キー以外が混ざればフラット扱い', () => {
    expect(isScopedWidgetPrefs({ global: flat, 'kpi-cards': { enabled: true } })).toBe(false)
  })

  it('null / 配列 / 空オブジェクトは scoped ではない', () => {
    expect(isScopedWidgetPrefs(null)).toBe(false)
    expect(isScopedWidgetPrefs([])).toBe(false)
    expect(isScopedWidgetPrefs({})).toBe(false)
  })
})

describe('resolveWidgetPrefsScope', () => {
  it('旧フラット形式は global として読める（後方互換）', () => {
    expect(resolveWidgetPrefsScope(flat)).toEqual(flat)
    expect(resolveWidgetPrefsScope(flat, WIDGET_PREFS_GLOBAL_SCOPE)).toEqual(flat)
  })

  it('旧フラット形式に module scope を要求すると null（global 設定が漏れない）', () => {
    expect(resolveWidgetPrefsScope(flat, 'module:auto-body')).toBeNull()
  })

  it('scoped 形式から各 scope を分離して取り出せる', () => {
    const raw = { global: flat, 'module:auto-body': modulePrefs }
    expect(resolveWidgetPrefsScope(raw)).toEqual(flat)
    expect(resolveWidgetPrefsScope(raw, 'module:auto-body')).toEqual(modulePrefs)
    expect(resolveWidgetPrefsScope(raw, 'module:sales')).toBeNull()
  })

  it('null / 不正値は null', () => {
    expect(resolveWidgetPrefsScope(null)).toBeNull()
    expect(resolveWidgetPrefsScope(undefined)).toBeNull()
    expect(resolveWidgetPrefsScope('x')).toBeNull()
    expect(resolveWidgetPrefsScope([])).toBeNull()
    expect(resolveWidgetPrefsScope({})).toBeNull()
  })
})

describe('mergeWidgetPrefsScope', () => {
  it('旧フラット形式に module scope を書くと global へ移行して温存される', () => {
    const merged = mergeWidgetPrefsScope(flat, 'module:auto-body', modulePrefs)
    expect(merged).toEqual({ global: flat, 'module:auto-body': modulePrefs })
    // 移行後も従来どおり global が読める
    expect(resolveWidgetPrefsScope(merged)).toEqual(flat)
  })

  it('旧フラット形式に global を上書きすると scoped 形式へ移行する', () => {
    const next: DashboardWidgetPrefs = { 'kpi-cards': { enabled: true, order: 0 } }
    expect(mergeWidgetPrefsScope(flat, WIDGET_PREFS_GLOBAL_SCOPE, next)).toEqual({ global: next })
  })

  it('scoped 形式は他 scope を保持したまま対象 scope だけ更新する', () => {
    const raw = { global: flat, 'module:sales': { 'sales-counts': { enabled: false } } }
    const merged = mergeWidgetPrefsScope(raw, 'module:auto-body', modulePrefs)
    expect(merged.global).toEqual(flat)
    expect(merged['module:sales']).toEqual({ 'sales-counts': { enabled: false } })
    expect(merged['module:auto-body']).toEqual(modulePrefs)
  })

  it('未設定 (null) からの新規保存', () => {
    expect(mergeWidgetPrefsScope(null, 'module:crm-core', {})).toEqual({ 'module:crm-core': {} })
    expect(mergeWidgetPrefsScope(undefined, WIDGET_PREFS_GLOBAL_SCOPE, flat)).toEqual({ global: flat })
  })
})
