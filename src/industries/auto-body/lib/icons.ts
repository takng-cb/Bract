/**
 * auto-body 業種オーバーレイで使うアイコン定数。
 * UI 上で同じ概念を表すアイコンを統一するため一箇所で定義する。
 *
 * 絵文字なのは:
 *   - ライブラリ追加不要、SSR でも動く
 *   - 多くの板金屋スタッフが見て直感的に分かる
 *   - 配色テーマと干渉しない
 */

export const AB_ICONS = {
  // オブジェクト
  maintenance:     '🔧',  // 整備
  customerVehicle: '🚙',  // 顧客車両（整備対象）
  vehicle:         '🚗',  // 車両（在庫）
  part:            '🪛',  // 部品マスタ

  // 整備の構成要素
  lineItem:        '🔩',  // 作業項目（行アイテム）
  fee:             '💴',  // 諸費用
  payment:         '💰',  // 入金
  document:        '📄',  // 帳票
  damagePin:       '📍',  // 損傷箇所マップ ピン
  template:        '📋',  // 整備パッケージ・テンプレート

  // CRM 標準
  account:         '🏢',
  contact:         '👤',
  opportunity:     '💼',
  activity:        '🗒️',
  task:            '✅',
  expense:         '🧾',

  // ステータス・状態
  done:            '✓',
  warning:         '⚠️',
  branch:          '🏪',  // 拠点
} as const

export type AbIcon = typeof AB_ICONS[keyof typeof AB_ICONS]

// ステータス色（auto-body の業務色 — 工場感を出すため amber 系を活用）
export const STATUS_PALETTE: Record<string, { bg: string; text: string; border: string; activeColor: string; pastColor: string }> = {
  '予約':     { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300',  activeColor: '#475569', pastColor: '#cbd5e1' },
  '受付':     { bg: 'bg-sky-100',    text: 'text-sky-800',    border: 'border-sky-300',    activeColor: '#0369a1', pastColor: '#7dd3fc' },
  '作業中':   { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300',  activeColor: '#b45309', pastColor: '#fcd34d' },
  '部品待ち': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400', activeColor: '#a16207', pastColor: '#fde047' },
  '納車待ち': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', activeColor: '#c2410c', pastColor: '#fdba74' },
  '完了':     { bg: 'bg-emerald-100',text: 'text-emerald-800',border: 'border-emerald-300',activeColor: '#047857', pastColor: '#6ee7b7' },
  'キャンセル':{ bg: 'bg-rose-100',  text: 'text-rose-800',   border: 'border-rose-300',   activeColor: '#be123c', pastColor: '#fda4af' },
}

/** 整備のステータス一覧 (実行順 + キャンセル) */
export const MAINTENANCE_STATUSES = ['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了', 'キャンセル'] as const
export type MaintenanceStatus = typeof MAINTENANCE_STATUSES[number]
