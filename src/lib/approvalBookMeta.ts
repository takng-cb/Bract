/**
 * レコード承認の設定 UI 用ブックメタ（REQ-0037 / #85 Phase2）
 *
 * - statusField: ステータス遷移トリガーの既定フィールド（null = ステータス概念なし）
 * - statusOptions: 既知のステータス値（from/to の選択肢。自由入力も許可）
 * - conditionFields: 条件によく使う項目の候補（datalist 用。自由入力も許可）
 *
 * 純データのみ（client/server 両方から import 可）。
 * 値は各ページの StageBar 定義（statusStages.ts ほか）と一致させること。
 */

export type StatusOption = { value: string; label: string }
export type ApprovalBookMeta = {
  api: string
  label: string
  statusField: string | null
  statusOptions: StatusOption[]
  conditionFields: { name: string; label: string }[]
}

export const APPROVAL_BOOK_META: ApprovalBookMeta[] = [
  {
    api: 'opportunities', label: '商談', statusField: 'stage',
    statusOptions: [
      { value: 'prospecting',   label: '見込み' },
      { value: 'qualification', label: '要件確認' },
      { value: 'proposal',      label: '提案' },
      { value: 'negotiation',   label: '交渉' },
      { value: 'closed_won',    label: '受注' },
      { value: 'closed_lost',   label: '失注' },
    ],
    conditionFields: [
      { name: 'amount', label: '金額' }, { name: 'probability', label: '確度' }, { name: 'name', label: '商談名' },
    ],
  },
  {
    api: 'accounts', label: '取引先', statusField: 'status',
    statusOptions: [
      { value: 'prospect', label: '見込み' },
      { value: 'active',   label: '有効' },
      { value: 'inactive', label: '無効' },
    ],
    conditionFields: [{ name: 'name', label: '取引先名' }, { name: 'industry', label: '業種' }],
  },
  {
    api: 'expenses', label: '経費', statusField: null, statusOptions: [],
    conditionFields: [
      { name: 'amount', label: '金額' }, { name: 'category', label: 'カテゴリ' }, { name: 'title', label: '件名' },
    ],
  },
  {
    api: 'maintenance_records', label: '整備', statusField: 'status',
    statusOptions: [
      { value: '予約', label: '予約' }, { value: '受付', label: '受付' }, { value: '作業中', label: '作業中' },
      { value: '部品待ち', label: '部品待ち' }, { value: '納車待ち', label: '納車待ち' }, { value: '完了', label: '完了' },
    ],
    conditionFields: [{ name: 'maintenance_no', label: '整備番号' }],
  },
  {
    api: 'vehicles', label: '車両', statusField: 'status',
    statusOptions: [
      { value: '在庫', label: '在庫' }, { value: '車検中', label: '車検中' }, { value: 'メンテ中', label: 'メンテ中' },
      { value: '修理中', label: '修理中' }, { value: '代車中', label: '代車中' }, { value: '納車待ち', label: '納車待ち' },
      { value: '販売済', label: '販売済' }, { value: '廃車', label: '廃車' },
    ],
    conditionFields: [{ name: 'sale_price', label: '販売価格' }, { name: 'maker', label: 'メーカー' }],
  },
  {
    api: 'properties', label: '物件', statusField: 'status',
    statusOptions: [
      { value: '募集中', label: '募集中' }, { value: '提案中', label: '提案中' }, { value: '交渉中', label: '交渉中' },
      { value: '成約', label: '成約' }, { value: '管理中', label: '管理中' }, { value: '終了', label: '終了' },
    ],
    conditionFields: [{ name: 'price', label: '価格' }, { name: 'address', label: '所在地' }],
  },
  {
    api: 'staff', label: 'スタッフ', statusField: 'status',
    statusOptions: [
      { value: '稼働中', label: '稼働中' }, { value: '一時休止', label: '一時休止' }, { value: '引退', label: '引退' },
    ],
    conditionFields: [{ name: 'name', label: '氏名' }],
  },
  {
    api: 'assignments', label: '案件', statusField: 'status',
    statusOptions: [
      { value: '受付', label: '受付' }, { value: '打診中', label: '打診中' }, { value: '候補集約', label: '候補集約' },
      { value: '確定', label: '確定' }, { value: '実施', label: '実施' }, { value: '完了', label: '完了' },
      { value: 'キャンセル', label: 'キャンセル' },
    ],
    conditionFields: [{ name: 'title', label: '案件名' }],
  },
]
