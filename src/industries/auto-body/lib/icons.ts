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
  // バッジ色は semantic tone（ADR-0021）。activeColor/pastColor はタイムライン用の固定 hex のまま。
  '予約':     { bg: 'bg-n-100',       text: 'text-n-600',     border: 'border-n-200', activeColor: '#475569', pastColor: '#cbd5e1' },
  '受付':     { bg: 'bg-info-bg',     text: 'text-info',      border: 'border-n-200', activeColor: '#0369a1', pastColor: '#7dd3fc' },
  '作業中':   { bg: 'bg-brand-50',    text: 'text-brand-700', border: 'border-n-200', activeColor: '#b45309', pastColor: '#fcd34d' },
  '部品待ち': { bg: 'bg-warning-bg',  text: 'text-warning',   border: 'border-n-200', activeColor: '#a16207', pastColor: '#fde047' },
  '納車待ち': { bg: 'bg-info-bg',     text: 'text-info',      border: 'border-n-200', activeColor: '#c2410c', pastColor: '#fdba74' },
  '完了':     { bg: 'bg-positive-bg', text: 'text-positive',  border: 'border-n-200', activeColor: '#047857', pastColor: '#6ee7b7' },
  'キャンセル':{ bg: 'bg-n-100',      text: 'text-n-600',     border: 'border-n-200', activeColor: '#be123c', pastColor: '#fda4af' },
}

/** 整備のステータス一覧 (実行順 + キャンセル) */
export const MAINTENANCE_STATUSES = ['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了', 'キャンセル'] as const
export type MaintenanceStatus = typeof MAINTENANCE_STATUSES[number]
