/**
 * ステータス系フィールドの矢羽根（StageBar）表示用ステージ定義（REQ-0020）
 *
 * すべてのステータスを矢羽根で統一表示するための共有設定。
 * activeColor=現在ステージ色、pastColor=通過済み色（いずれも hex）。
 * 値（value）は各テーブルの status カラムの値と一致させる。
 */
import type { StageConfig } from '@/components/StageBar'

/** 人材手配・案件（assignments.status） */
export const ASSIGNMENT_STAGES: StageConfig[] = [
  { value: '受付',       label: '受付',       activeColor: '#475569', pastColor: '#cbd5e1' },
  { value: '打診中',     label: '打診中',     activeColor: '#0369a1', pastColor: '#7dd3fc' },
  { value: '候補集約',   label: '候補集約',   activeColor: '#7c3aed', pastColor: '#c4b5fd' },
  { value: '確定',       label: '確定',       activeColor: '#b45309', pastColor: '#fcd34d' },
  { value: '実施',       label: '実施',       activeColor: '#c2410c', pastColor: '#fdba74' },
  { value: '完了',       label: '完了',       activeColor: '#047857', pastColor: '#6ee7b7' },
  { value: 'キャンセル', label: 'キャンセル', activeColor: '#be123c', pastColor: '#fda4af' },
]

/** スタッフ（staff.status） */
export const STAFF_STAGES: StageConfig[] = [
  { value: '稼働中',   label: '稼働中',   activeColor: '#16a34a', pastColor: '#86efac' },
  { value: '一時休止', label: '一時休止', activeColor: '#b45309', pastColor: '#fcd34d' },
  { value: '引退',     label: '引退',     activeColor: '#71717a', pastColor: '#d4d4d8' },
]

/** 不動産・物件（properties.status） */
export const PROPERTY_STAGES: StageConfig[] = [
  { value: '募集中', label: '募集中', activeColor: '#0369a1', pastColor: '#7dd3fc' },
  { value: '提案中', label: '提案中', activeColor: '#7c3aed', pastColor: '#c4b5fd' },
  { value: '交渉中', label: '交渉中', activeColor: '#b45309', pastColor: '#fcd34d' },
  { value: '成約',   label: '成約',   activeColor: '#047857', pastColor: '#6ee7b7' },
  { value: '管理中', label: '管理中', activeColor: '#6d28d9', pastColor: '#c4b5fd' },
  { value: '終了',   label: '終了',   activeColor: '#71717a', pastColor: '#d4d4d8' },
]

/** 車両・在庫（vehicles.status） */
export const VEHICLE_STAGES: StageConfig[] = [
  { value: '在庫',     label: '在庫',     activeColor: '#475569', pastColor: '#cbd5e1' },
  { value: '車検中',   label: '車検中',   activeColor: '#0369a1', pastColor: '#7dd3fc' },
  { value: 'メンテ中', label: 'メンテ中', activeColor: '#7c3aed', pastColor: '#c4b5fd' },
  { value: '修理中',   label: '修理中',   activeColor: '#b45309', pastColor: '#fcd34d' },
  { value: '代車中',   label: '代車中',   activeColor: '#c2410c', pastColor: '#fdba74' },
  { value: '納車待ち', label: '納車待ち', activeColor: '#0d9488', pastColor: '#5eead4' },
  { value: '販売済',   label: '販売済',   activeColor: '#047857', pastColor: '#6ee7b7' },
  { value: '廃車',     label: '廃車',     activeColor: '#71717a', pastColor: '#d4d4d8' },
]
