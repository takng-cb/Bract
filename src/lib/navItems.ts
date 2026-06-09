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
  { href: '/dashboard',     label: 'ダッシュボード', icon: '📊' },
  { href: '/accounts',      label: '取引先',        icon: '🏢' },
  { href: '/contacts',      label: '人物',          icon: '👤' },
  { href: '/opportunities', label: '商談',          icon: '💼' },
  { href: '/forecast',      label: '売上予測',      icon: '📊' },
  { href: '/activities',    label: '活動履歴',      icon: '🗓️' },
  { href: '/tasks',         label: 'ToDo',          icon: '✅' },
  { href: '/expenses',      label: '経費管理',      icon: '💰' },
  // /properties はカスタムオブジェクト化のため削除。
  // DB の object_definitions (api_name='properties') から自動的にサイドバーに表示される。
]

/**
 * サイドバー下部（固定・順序変更不可）。
 *
 * 設定・管理系の入口は「設定」1つに集約する（各管理画面は /settings からカードで遷移）。
 * 個別の /admin/* や /tags はサイドバーに直接出さず、設定ハブ経由で到達する。
 */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/settings',       label: '設定',           icon: '⚙️' },
  { href: '/about',          label: '使い方',         icon: '💡' },
]

/** 管理者のみに出す「システム設定」入口（個人設定とは別メニュー）。 */
export const SYSTEM_SETTINGS_ITEM: NavItem = { href: '/settings/system', label: 'システム設定', icon: '🛠️' }

/**
 * 設定ハブ（/settings）から遷移する管理画面の一覧。
 * すべて管理者専用ページ。AI 設定は AI 機能が有効な場合のみ表示。
 */
export type AdminLink = { href: string; label: string; icon: string; desc: string; aiGated?: boolean }
export const ADMIN_LINKS: AdminLink[] = [
  { href: '/admin/modules',       label: 'モジュール構成',   icon: '🧩',  desc: '機能モジュールの有効/無効' },
  { href: '/admin/objects',       label: 'オブジェクト管理', icon: '🗂️', desc: 'オブジェクト・フィールド・並び順' },
  { href: '/admin/relationships', label: '関係性管理',       icon: '🔗',  desc: 'オブジェクト間のリレーション' },
  { href: '/admin/users',         label: 'ユーザー管理',     icon: '👥',  desc: '権限・パスワード・削除' },
  { href: '/tags',                label: 'タグ管理',         icon: '🏷️', desc: 'タグの作成・整理' },
  { href: '/admin/ai',            label: 'AI 設定',          icon: '🤖',  desc: 'プロバイダ・APIキー・プロンプト', aiGated: true },
  { href: '/admin/notifications', label: '通知設定',         icon: '🔔',  desc: '外部通知チャンネル' },
  { href: '/admin/license',       label: 'ライセンス',       icon: '🎫',  desc: '契約状態・機能フラグ' },
  { href: '/admin/system',        label: '全般設定',         icon: '🛠️', desc: '会社情報・パスワード・危険操作' },
  { href: '/admin/import-logs',   label: 'インポートログ',   icon: '📥',  desc: 'CSV取込の実行履歴' },
  { href: '/admin/audit-log',     label: '監査ログ',         icon: '📝',  desc: '全社の変更履歴' },
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
