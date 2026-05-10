import type { Industry } from '@/lib/industry'

export type NavItem = {
  href:  string
  label: string
  icon:  string
}

/** カスタムオブジェクト定義の最小スキーマ（NavItem 化に必要なフィールドのみ） */
type ObjectForNav = {
  api_name:     string
  label_plural: string
  icon:         string
}

/**
 * カスタムオブジェクトを NavItem に変換する共通ヘルパー。
 *
 * 業種オーバーレイで業種専用ルートを持つオブジェクト
 * (例: real-estate モードの properties) は `/objects/<api>` ではなく
 * 業種専用 URL (`/properties` 等) に向ける。
 *
 * これを共通化することで、サイドバー（layout.tsx）と
 * 並び替え画面（settings/page.tsx）の URL がドリフトしないようにする。
 */
export function customObjectsToNavItems(
  objects: ObjectForNav[],
  activeIndustry: Industry,
): NavItem[] {
  return objects.map((o) => ({
    href:  hrefForCustomObject(o.api_name, activeIndustry),
    label: o.label_plural,
    icon:  o.icon,
  }))
}

/** カスタムオブジェクトの api_name + 業種 → URL */
function hrefForCustomObject(apiName: string, activeIndustry: Industry): string {
  // 業種オーバーレイ専用ルートを持つものは overlay の URL に向ける
  if (activeIndustry === 'real-estate' && apiName === 'properties') return '/properties'
  if (activeIndustry === 'auto-body'   && apiName === 'vehicles')   return '/vehicles'
  if (activeIndustry === 'auto-body'   && apiName === 'parts')      return '/parts'
  return `/objects/${apiName}`
}

/** メインナビに並べられる全アイテム（マスター定義） */
export const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'ダッシュボード', icon: '🏠' },
  { href: '/accounts',      label: '取引先',        icon: '🏢' },
  { href: '/contacts',      label: '人物',          icon: '👤' },
  { href: '/opportunities', label: '商談',          icon: '💼' },
  { href: '/forecast',      label: '売上予測',      icon: '📊' },
  { href: '/activities',    label: '活動履歴',      icon: '📋' },
  { href: '/tasks',         label: 'ToDo',          icon: '✅' },
  { href: '/expenses',      label: '経費管理',      icon: '💰' },
  // /properties はカスタムオブジェクト化のため削除。
  // DB の object_definitions (api_name='properties') から自動的にサイドバーに表示される。
]

/** サイドバー下部（固定・順序変更不可） */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/tags',           label: 'タグ管理',       icon: '🏷️' },
  { href: '/admin/objects',        label: 'オブジェクト管理', icon: '🗂️' },
  { href: '/admin/relationships',  label: '関係性管理',       icon: '🔗' },
  { href: '/admin/users',          label: 'ユーザー管理',     icon: '👥' },
  { href: '/admin/import-logs',    label: 'インポートログ',   icon: '📥' },
  { href: '/settings',       label: '設定',           icon: '⚙️' },
  { href: '/about',          label: '使い方',         icon: '💡' },
]

/** デフォルト順序（hrefs配列） */
export const DEFAULT_NAV_ORDER: string[] = ALL_NAV_ITEMS.map((i) => i.href)

/**
 * href配列を受け取り、全アイテム（静的＋カスタム）を並び替えたNavItem配列を返す。
 * 順序リストにないアイテムは末尾に追加される。
 * @param order  保存済みの href 順序
 * @param extraItems  カスタムオブジェクトなど動的に追加されるアイテム
 */
export function applyNavOrder(order: string[], extraItems: NavItem[] = []): NavItem[] {
  const allItems = [...ALL_NAV_ITEMS, ...extraItems]
  const map      = new Map(allItems.map((i) => [i.href, i]))
  const ordered  = order.filter((h) => map.has(h)).map((h) => map.get(h)!)
  const missing  = allItems.filter((i) => !order.includes(i.href))
  return [...ordered, ...missing]
}
