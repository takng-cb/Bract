import { describe, it, expect } from 'vitest'
import {
  buildExtraNavItems,
  industryFallbackNavItems,
  customObjectsToNavItems,
  ALL_NAV_ITEMS,
  type NavItem,
} from './navItems'

describe('buildExtraNavItems（モジュール外ナビ項目の既定順構築）', () => {
  it('dashboard を除く静的ナビ → カスタム の順で並ぶ', () => {
    const custom: NavItem[] = [{ href: '/objects/reservations', label: '予約', icon: '📅' }]
    const result = buildExtraNavItems(custom, 'base')
    const staticHrefs = ALL_NAV_ITEMS.filter((i) => i.href !== '/dashboard').map((i) => i.href)
    expect(result.map((i) => i.href)).toEqual([...staticHrefs, '/objects/reservations'])
    expect(result.some((i) => i.href === '/dashboard')).toBe(false)
  })

  it('auto-body では業種フォールバック項目が補完される', () => {
    const result = buildExtraNavItems([], 'auto-body')
    expect(result.some((i) => i.href === '/maintenance')).toBe(true)
    expect(result.some((i) => i.href === '/vehicles')).toBe(true)
  })

  it('カスタム項目と業種フォールバックの href 重複はカスタム優先', () => {
    const custom: NavItem[] = [{ href: '/vehicles', label: '車両（カスタム）', icon: '🚗' }]
    const result = buildExtraNavItems(custom, 'auto-body')
    const vehicles = result.filter((i) => i.href === '/vehicles')
    expect(vehicles).toHaveLength(1)
    expect(vehicles[0].label).toBe('車両（カスタム）')
  })

  it('base では業種フォールバックが空', () => {
    expect(industryFallbackNavItems('base')).toEqual([])
  })
})

describe('customObjectsToNavItems（カスタムオブジェクト → NavItem 変換、業種別 URL）', () => {
  const props = { api_name: 'properties', label_plural: '物件', icon: '🏠' }
  const veh = { api_name: 'vehicles', label_plural: '車両', icon: '🚗' }
  const parts = { api_name: 'parts', label_plural: '部品', icon: '🔧' }
  const generic = { api_name: 'reservations', label_plural: '予約', icon: '📅' }

  it('real-estate モードで properties → /properties（業種専用 URL）', () => {
    const result = customObjectsToNavItems([props], 'real-estate')
    expect(result[0]).toEqual({ href: '/properties', label: '物件', icon: '🏠' })
  })

  it('real-estate モードで vehicles → /objects/vehicles（汎用 URL、業種専用ルートではない）', () => {
    const result = customObjectsToNavItems([veh], 'real-estate')
    expect(result[0].href).toBe('/objects/vehicles')
  })

  it('auto-body モードで vehicles → /vehicles（業種専用 URL）', () => {
    const result = customObjectsToNavItems([veh], 'auto-body')
    expect(result[0].href).toBe('/vehicles')
  })

  it('auto-body モードで parts → /parts（業種専用 URL）', () => {
    const result = customObjectsToNavItems([parts], 'auto-body')
    expect(result[0].href).toBe('/parts')
  })

  it('auto-body モードで properties → /objects/properties（業種専用ルートではない）', () => {
    const result = customObjectsToNavItems([props], 'auto-body')
    expect(result[0].href).toBe('/objects/properties')
  })

  it('base モードでは全部 /objects/<api> に向く', () => {
    const result = customObjectsToNavItems([props, veh, parts], 'base')
    expect(result.map((i) => i.href)).toEqual([
      '/objects/properties',
      '/objects/vehicles',
      '/objects/parts',
    ])
  })

  it('未知のカスタムオブジェクトはどの業種でも /objects/<api>', () => {
    expect(customObjectsToNavItems([generic], 'base')[0].href).toBe('/objects/reservations')
    expect(customObjectsToNavItems([generic], 'real-estate')[0].href).toBe('/objects/reservations')
    expect(customObjectsToNavItems([generic], 'auto-body')[0].href).toBe('/objects/reservations')
  })

  it('label_plural と icon はそのまま保持', () => {
    const result = customObjectsToNavItems([{ api_name: 'foo', label_plural: 'バー', icon: '🎯' }], 'base')
    expect(result[0]).toEqual({ href: '/objects/foo', label: 'バー', icon: '🎯' })
  })
})
