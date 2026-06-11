/**
 * ナビ順序 v2: 「モジュールの並び」＋「モジュール内のブックの並び」の2階層（REQ-0035）。
 *
 * 保存形式（user_preferences.nav_order / system_settings.nav_order）:
 *   v2: { "v": 2, "modules": ["crm-core", "sales", ...], "books": { "crm-core": ["/accounts", ...], ... } }
 *   旧: ["/dashboard", "/accounts", ...]（フラット配列。後方互換で読める）
 *
 * 純関数のみ（client/server 両方から import 可）。
 */
import type { NavItem } from '@/lib/navItems'
import type { ModuleManifest, ModuleCategory } from '@/lib/modules/types'

export type NavGroup = { id: string; name: string; items: NavItem[] }
export type NavOrderV2 = { v: 2; modules: string[]; books: Record<string, string[]> }

const CATEGORY_RANK: Record<ModuleCategory, number> = { platform: 0, crm: 1, erp: 2, industry: 3 }

/** その他（どのモジュールにも属さない項目）の擬似グループ ID */
export const OTHER_GROUP_ID = '__other'

/** 保存文字列をパース（v2 / 旧フラット / 不正は null） */
export function parseNavOrder(raw: string | null | undefined): NavOrderV2 | string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed
    if (parsed && typeof parsed === 'object' && parsed.v === 2 && Array.isArray(parsed.modules)) {
      return { v: 2, modules: parsed.modules, books: parsed.books ?? {} }
    }
  } catch { /* fall through */ }
  return null
}

export function isV2(o: NavOrderV2 | string[] | null): o is NavOrderV2 {
  return !!o && !Array.isArray(o) && o.v === 2
}

/**
 * 有効モジュール＋追加項目（カスタムブック等）からナビグループを構築する（既定順）。
 * layout.tsx（サイドバー）と並び替え画面で共用し、構造のドリフトを防ぐ。
 * dashboard はグループ外（呼び出し側で除外して渡す）。
 */
export function buildNavGroups(enabledModules: ModuleManifest[], extraItems: NavItem[]): NavGroup[] {
  const moduleHrefs = new Set<string>()
  const groups: NavGroup[] = enabledModules
    .filter((m) => (m.navItems?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9))
    .map((m) => {
      const items: NavItem[] = (m.navItems ?? []).map((n) => ({ href: n.href, label: n.label, icon: n.icon }))
      items.forEach((i) => moduleHrefs.add(i.href))
      return { id: m.id, name: m.name, items }
    })

  const otherItems = extraItems.filter((i) => !moduleHrefs.has(i.href))
  if (otherItems.length) groups.push({ id: OTHER_GROUP_ID, name: 'その他', items: otherItems })
  return groups
}

/**
 * 保存済み順序をグループに適用する。
 * - v2: modules[] でグループを並べ替え（未知のグループは既定順のまま末尾に）、
 *        books[groupId] で各グループ内の項目を並べ替え（未知の項目は末尾に）。
 * - 旧フラット配列: グループ順は既定のまま、各グループ内をフラット index 順に並べ替え。
 */
export function applyNavOrderToGroups(groups: NavGroup[], order: NavOrderV2 | string[] | null): NavGroup[] {
  if (!order) return groups

  const sortItems = (items: NavItem[], wanted: string[] | undefined): NavItem[] => {
    if (!wanted || wanted.length === 0) return items
    const rank = new Map(wanted.map((h, i) => [h, i]))
    return items.slice().sort((a, b) => {
      const ra = rank.has(a.href) ? rank.get(a.href)! : Number.MAX_SAFE_INTEGER
      const rb = rank.has(b.href) ? rank.get(b.href)! : Number.MAX_SAFE_INTEGER
      return ra - rb
    })
  }

  if (isV2(order)) {
    const groupRank = new Map(order.modules.map((id, i) => [id, i]))
    const sorted = groups.slice().sort((a, b) => {
      const ra = groupRank.has(a.id) ? groupRank.get(a.id)! : Number.MAX_SAFE_INTEGER
      const rb = groupRank.has(b.id) ? groupRank.get(b.id)! : Number.MAX_SAFE_INTEGER
      return ra - rb
    })
    return sorted.map((g) => ({ ...g, items: sortItems(g.items, order.books[g.id]) }))
  }

  // 旧フラット配列：グループ内のみ並べ替え
  return groups.map((g) => ({ ...g, items: sortItems(g.items, order) }))
}
