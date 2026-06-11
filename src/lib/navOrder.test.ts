import { describe, it, expect } from 'vitest'
import {
  parseNavOrder,
  isV2,
  buildNavGroups,
  applyNavOrderToGroups,
  OTHER_GROUP_ID,
  type NavGroup,
  type NavOrderV2,
} from './navOrder'
import type { ModuleManifest } from '@/lib/modules/types'
import type { NavItem } from '@/lib/navItems'

// ── テスト用フィクスチャ ─────────────────────────────────────────────
const crmCore: ModuleManifest = {
  id: 'crm-core', name: '顧客管理', category: 'crm',
  navItems: [
    { href: '/accounts', label: '取引先', icon: '🏢' },
    { href: '/contacts', label: '人物',   icon: '👤' },
  ],
}
const sales: ModuleManifest = {
  id: 'sales', name: '商談管理', category: 'crm',
  navItems: [
    { href: '/opportunities', label: '商談',     icon: '💼' },
    { href: '/forecast',      label: '売上予測', icon: '📊' },
  ],
}
const inventory: ModuleManifest = {
  id: 'inventory', name: '在庫管理', category: 'erp',
  navItems: [{ href: '/products', label: '商品', icon: '📦' }],
}
const workspace: ModuleManifest = {
  id: 'workspace', name: 'ワークスペース', category: 'platform',
  navItems: [{ href: '/tasks', label: 'ToDo', icon: '✅' }],
}
const noNav: ModuleManifest = { id: 'empty', name: '空', category: 'erp' }

const customItems: NavItem[] = [
  { href: '/books/reservations', label: '予約', icon: '📅' },
]

describe('parseNavOrder（保存文字列のパース）', () => {
  it('v2 形式をパースできる', () => {
    const raw = JSON.stringify({ v: 2, modules: ['sales', 'crm-core'], books: { sales: ['/forecast'] } })
    const result = parseNavOrder(raw)
    expect(isV2(result)).toBe(true)
    expect((result as NavOrderV2).modules).toEqual(['sales', 'crm-core'])
    expect((result as NavOrderV2).books).toEqual({ sales: ['/forecast'] })
  })

  it('books 欠落の v2 は空オブジェクトで補完', () => {
    const result = parseNavOrder(JSON.stringify({ v: 2, modules: ['a'] }))
    expect(isV2(result)).toBe(true)
    expect((result as NavOrderV2).books).toEqual({})
  })

  it('旧フラット配列をそのまま返す', () => {
    const result = parseNavOrder(JSON.stringify(['/a', '/b']))
    expect(result).toEqual(['/a', '/b'])
    expect(isV2(result)).toBe(false)
  })

  it('null / 空 / 不正 JSON / 不正型は null', () => {
    expect(parseNavOrder(null)).toBeNull()
    expect(parseNavOrder(undefined)).toBeNull()
    expect(parseNavOrder('')).toBeNull()
    expect(parseNavOrder('{not json')).toBeNull()
    expect(parseNavOrder(JSON.stringify({ v: 1 }))).toBeNull()
    expect(parseNavOrder(JSON.stringify([1, 2]))).toBeNull()
  })
})

describe('buildNavGroups（モジュール → ナビグループ構築）', () => {
  it('カテゴリ順（platform → crm → erp）に並び、同カテゴリは入力順維持・navItems 無しは除外', () => {
    const groups = buildNavGroups([inventory, sales, noNav, workspace, crmCore], [])
    expect(groups.map((g) => g.id)).toEqual(['workspace', 'sales', 'crm-core', 'inventory'])
  })

  it('モジュールに属さない extraItems は「その他」グループへ', () => {
    const groups = buildNavGroups([crmCore], customItems)
    const other = groups.find((g) => g.id === OTHER_GROUP_ID)
    expect(other).toBeDefined()
    expect(other!.items.map((i) => i.href)).toEqual(['/books/reservations'])
  })

  it('モジュールと重複する extraItems は「その他」に出ない', () => {
    const dup: NavItem[] = [{ href: '/accounts', label: '取引先', icon: '🏢' }, ...customItems]
    const groups = buildNavGroups([crmCore], dup)
    const other = groups.find((g) => g.id === OTHER_GROUP_ID)
    expect(other!.items.map((i) => i.href)).toEqual(['/books/reservations'])
  })

  it('extraItems が空ならその他グループ自体が無い', () => {
    const groups = buildNavGroups([crmCore], [])
    expect(groups.some((g) => g.id === OTHER_GROUP_ID)).toBe(false)
  })
})

describe('applyNavOrderToGroups（保存済み順序の適用）', () => {
  const groups: NavGroup[] = buildNavGroups([crmCore, sales], customItems)

  it('order = null なら既定順のまま', () => {
    expect(applyNavOrderToGroups(groups, null)).toEqual(groups)
  })

  it('v2: モジュール順とグループ内ブック順の両方を並び替える', () => {
    const order: NavOrderV2 = {
      v: 2,
      modules: ['sales', OTHER_GROUP_ID, 'crm-core'],
      books: { 'crm-core': ['/contacts', '/accounts'] },
    }
    const result = applyNavOrderToGroups(groups, order)
    expect(result.map((g) => g.id)).toEqual(['sales', OTHER_GROUP_ID, 'crm-core'])
    expect(result.find((g) => g.id === 'crm-core')!.items.map((i) => i.href))
      .toEqual(['/contacts', '/accounts'])
    // books 指定の無いグループは既定順のまま
    expect(result.find((g) => g.id === 'sales')!.items.map((i) => i.href))
      .toEqual(['/opportunities', '/forecast'])
  })

  it('v2: modules に無いグループは既定順で末尾に残る', () => {
    const order: NavOrderV2 = { v: 2, modules: ['sales'], books: {} }
    const result = applyNavOrderToGroups(groups, order)
    expect(result.map((g) => g.id)).toEqual(['sales', 'crm-core', OTHER_GROUP_ID])
  })

  it('v2: books に無い href はグループ内末尾に残る', () => {
    const order: NavOrderV2 = { v: 2, modules: [], books: { sales: ['/forecast'] } }
    const result = applyNavOrderToGroups(groups, order)
    expect(result.find((g) => g.id === 'sales')!.items.map((i) => i.href))
      .toEqual(['/forecast', '/opportunities'])
  })

  it('旧フラット配列: グループ順は不変・各グループ内のみ並び替え', () => {
    const result = applyNavOrderToGroups(groups, ['/forecast', '/opportunities', '/contacts'])
    expect(result.map((g) => g.id)).toEqual(groups.map((g) => g.id))
    expect(result.find((g) => g.id === 'sales')!.items.map((i) => i.href))
      .toEqual(['/forecast', '/opportunities'])
    expect(result.find((g) => g.id === 'crm-core')!.items.map((i) => i.href))
      .toEqual(['/contacts', '/accounts'])
  })

  it('順序に存在しない href があっても安全（無視される）', () => {
    const order: NavOrderV2 = {
      v: 2,
      modules: ['ghost-module', 'sales'],
      books: { sales: ['/nonexistent', '/forecast'] },
    }
    const result = applyNavOrderToGroups(groups, order)
    expect(result[0].id).toBe('sales')
    expect(result[0].items.map((i) => i.href)).toEqual(['/forecast', '/opportunities'])
    expect(result.some((g) => g.id === 'ghost-module')).toBe(false)
  })
})
