export type NavItem = {
  href:  string
  label: string
  icon:  string
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
 * href配列を受け取り、ALL_NAV_ITEMSを並び替えたNavItem配列を返す。
 * 順序リストにないアイテムは末尾に追加される。
 */
export function applyNavOrder(order: string[]): NavItem[] {
  const map      = new Map(ALL_NAV_ITEMS.map((i) => [i.href, i]))
  const ordered  = order.filter((h) => map.has(h)).map((h) => map.get(h)!)
  const missing  = ALL_NAV_ITEMS.filter((i) => !order.includes(i.href))
  return [...ordered, ...missing]
}
