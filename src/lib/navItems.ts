import type { Industry } from '@/lib/industry'

export type NavItem = {
  href:  string
  label: string
  icon:  string
}

/** カスタムブック定義の最小スキーマ（NavItem 化に必要なフィールドのみ） */
type BookForNav = {
  api_name:     string
  label_plural: string
  icon:         string
}

/**
 * カスタムブックを NavItem に変換する共通ヘルパー。
 *
 * 業種オーバーレイで業種専用ルートを持つブック
 * (例: real-estate モードの properties) は `/books/<api>` ではなく
 * 業種専用 URL (`/properties` 等) に向ける。
 *
 * これを共通化することで、サイドバー（layout.tsx）と
 * 並び替え画面（settings/page.tsx）の URL がドリフトしないようにする。
 */
export function customBooksToNavItems(
  books: BookForNav[],
  activeIndustry: Industry,
): NavItem[] {
  return books.map((o) => ({
    href:  hrefForCustomBook(o.api_name, activeIndustry),
    label: o.label_plural,
    icon:  o.icon,
  }))
}

/** カスタムブックの api_name + 業種 → URL */
function hrefForCustomBook(apiName: string, activeIndustry: Industry): string {
  // 業種オーバーレイ専用ルートを持つものは overlay の URL に向ける
  if (activeIndustry === 'real-estate' && apiName === 'properties') return '/properties'
  if (activeIndustry === 'auto-body'   && apiName === 'vehicles')   return '/vehicles'
  if (activeIndustry === 'auto-body'   && apiName === 'parts')      return '/parts'
  return `/books/${apiName}`
}

/**
 * 業種オーバーレイ専用ルートのナビ項目（book_definitions に行が無い場合のフォールバック）。
 * 初期セットアップ前でもサイドバーに表示できるようハードコードする。
 * layout.tsx（サイドバー）と並び替え画面（NavOrderEditor）で共用しドリフトを防ぐ。
 * 重複時は customBooksToNavItems 由来の項目を優先（呼び出し側で href 重複排除）。
 */
export function industryFallbackNavItems(activeIndustry: Industry): NavItem[] {
  if (activeIndustry === 'auto-body') {
    return [
      { href: '/maintenance',           label: '整備',         icon: '🔧' },
      { href: '/maintenance/templates', label: '整備パッケージ', icon: '📋' },
      { href: '/customer-vehicles',     label: '顧客車両',     icon: '🚙' },
      { href: '/vehicles',              label: '車両',         icon: '🚗' },
      { href: '/parts',                 label: '部品',         icon: '🪛' },
      { href: '/receivables',           label: '売掛金',       icon: '💰' },
    ]
  }
  if (activeIndustry === 'staffing') {
    return [
      { href: '/staff',       label: 'スタッフ', icon: '🧑‍💼' },
      { href: '/assignments', label: '案件',    icon: '📋' },
    ]
  }
  return []
}

/** メインナビに並べられる全アイテム（マスター定義） */
export const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'ホーム', icon: '📊' },
  { href: '/accounts',      label: '取引先',        icon: '🏢' },
  { href: '/contacts',      label: '人物',          icon: '👤' },
  { href: '/opportunities', label: '商談',          icon: '💼' },
  { href: '/forecast',      label: '売上予測',      icon: '📊' },
  { href: '/activities',    label: '活動履歴',      icon: '🗓️' },
  { href: '/tasks',         label: 'ToDo',          icon: '✅' },
  { href: '/expenses',      label: '経費管理',      icon: '💰' },
  // /properties はカスタムブック化のため削除。
  // DB の book_definitions (api_name='properties') から自動的にサイドバーに表示される。
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
export type AdminLink = {
  href: string; label: string; icon: string; desc: string; aiGated?: boolean
  /** true = サービス提供者（運営）向けの設定。テナント管理者の日常設定とはハブで分けて表示する */
  provider?: boolean
}
export const ADMIN_LINKS: AdminLink[] = [
  { href: '/admin/books',       label: 'ブック/モジュール管理', icon: '🗂️', desc: 'モジュールの有効/無効・ブック・フィールド・並び順' },
  { href: '/admin/relationships', label: '関係性管理',       icon: '🔗',  desc: 'ブック間のリレーション' },
  { href: '/admin/users',         label: 'ユーザー管理',     icon: '👥',  desc: '権限・パスワード・削除' },
  { href: '/admin/roles',         label: 'ロール管理',       icon: '🛡️', desc: 'ロール作成・ブック別CRUD権限・割当' },
  { href: '/tags',                label: 'タグ管理',         icon: '🏷️', desc: 'タグの作成・整理' },
  { href: '/admin/ai',            label: 'AI 設定',          icon: '🤖',  desc: 'プロバイダ・APIキー・プロンプト', aiGated: true },
  { href: '/admin/notifications', label: '通知設定',         icon: '🔔',  desc: '外部通知チャンネル' },
  { href: '/admin/system',        label: '全般設定',         icon: '🛠️', desc: '会社情報・パスワード・危険操作' },
  { href: '/admin/import-logs',   label: 'インポートログ',   icon: '📥',  desc: 'CSV取込の実行履歴' },
  { href: '/admin/audit-log',     label: '監査ログ',         icon: '📝',  desc: '全社の変更履歴' },
  // ── サービス提供者（運営）向け：契約・プラン・利用上限はテナント側で触らない ──
  { href: '/admin/license',       label: 'ライセンス',       icon: '🎫',  desc: '契約状態・プラン・機能フラグ（提供者が設定）', provider: true },
]

/**
 * モジュールに属さない可能性のあるナビ項目の既定順リストを構築する
 * （静的ナビ → カスタムブック → 業種フォールバック。dashboard はグループ外なので除外）。
 * buildNavGroups の extraItems としてサイドバー（layout.tsx）と
 * 並び替え画面（NavOrderEditor）の両方で使い、構造のドリフトを防ぐ。
 */
export function buildExtraNavItems(customNavItems: NavItem[], activeIndustry: Industry): NavItem[] {
  const industryItems = industryFallbackNavItems(activeIndustry)
  const allCustom = [
    ...customNavItems,
    ...industryItems.filter((i) => !customNavItems.some((c) => c.href === i.href)),
  ]
  return [
    ...ALL_NAV_ITEMS.filter((i) => i.href !== '/dashboard'),
    ...allCustom.filter((i) => !ALL_NAV_ITEMS.some((s) => s.href === i.href)),
  ]
}
