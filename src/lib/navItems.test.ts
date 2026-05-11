import { describe, it, expect } from 'vitest'
import {
  applyNavOrder,
  customObjectsToNavItems,
  ALL_NAV_ITEMS,
  DEFAULT_NAV_ORDER,
  type NavItem,
} from './navItems'

describe('applyNavOrder（ナビ項目の並び替え）', () => {
  it('全項目を指定すれば指定順に並ぶ', () => {
    const order = ['/contacts', '/accounts', '/dashboard']
    const result = applyNavOrder(order, [])
    expect(result.slice(0, 3).map((i) => i.href)).toEqual(order)
  })

  it('順序リストに無い項目は末尾に追加される', () => {
    const partial = ['/dashboard', '/accounts']
    const result = applyNavOrder(partial, [])
    expect(result[0].href).toBe('/dashboard')
    expect(result[1].href).toBe('/accounts')
    // 残りは ALL_NAV_ITEMS のうち partial に含まれていないものすべて
    const missing = ALL_NAV_ITEMS.filter((i) => !partial.includes(i.href))
    expect(result.length).toBe(ALL_NAV_ITEMS.length)
    expect(result.slice(2).map((i) => i.href)).toEqual(missing.map((i) => i.href))
  })

  it('空の順序 → ALL_NAV_ITEMS の元順序のまま', () => {
    const result = applyNavOrder([], [])
    expect(result.map((i) => i.href)).toEqual(ALL_NAV_ITEMS.map((i) => i.href))
  })

  it('extraItems が末尾に追加される', () => {
    const custom: NavItem[] = [
      { href: '/properties', label: '物件', icon: '🏠' },
    ]
    const result = applyNavOrder(DEFAULT_NAV_ORDER, custom)
    expect(result.some((i) => i.href === '/properties')).toBe(true)
    // /properties は順序リストに無いので末尾追加
    expect(result[result.length - 1].href).toBe('/properties')
  })

  it('extraItems が順序リストに含まれていれば、その位置に並ぶ', () => {
    const custom: NavItem[] = [
      { href: '/properties', label: '物件', icon: '🏠' },
    ]
    const order = ['/dashboard', '/properties', '/accounts']
    const result = applyNavOrder(order, custom)
    expect(result.slice(0, 3).map((i) => i.href)).toEqual(order)
  })

  it('順序リストに存在しない href は無視される（hidden link 防止）', () => {
    const order = ['/dashboard', '/nonexistent-route', '/accounts']
    const result = applyNavOrder(order, [])
    // 存在しないルートは結果に含まれない
    expect(result.some((i) => i.href === '/nonexistent-route')).toBe(false)
    expect(result[0].href).toBe('/dashboard')
    expect(result[1].href).toBe('/accounts')
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
