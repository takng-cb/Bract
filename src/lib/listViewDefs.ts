/** オブジェクト別・リストビューで使用可能なカラム定義 */

export type ColAvail = {
  key: string
  label: string
  defaultOn: boolean
}

export const LIST_VIEW_COLS: Record<string, ColAvail[]> = {
  accounts: [
    { key: 'name',           label: '会社名',     defaultOn: true },
    { key: 'industry',       label: '業種',       defaultOn: true },
    { key: 'type',           label: '種別',       defaultOn: true },
    { key: 'phone',          label: '電話番号',   defaultOn: true },
    { key: 'website',        label: 'Webサイト',  defaultOn: false },
    { key: 'address',        label: '住所',       defaultOn: false },
    { key: 'annual_revenue', label: '年間売上',   defaultOn: false },
    { key: 'employee_count', label: '従業員数',   defaultOn: false },
    { key: 'status',         label: 'ステータス', defaultOn: true },
  ],
  contacts: [
    { key: 'full_name',  label: '氏名',     defaultOn: true },
    { key: 'account',    label: '取引先',   defaultOn: true },
    { key: 'title',      label: '役職',     defaultOn: true },
    { key: 'department', label: '部署',     defaultOn: true },
    { key: 'email',      label: 'メール',   defaultOn: true },
    { key: 'phone',      label: '電話番号', defaultOn: true },
    { key: 'birthday',   label: '誕生日',   defaultOn: false },
  ],
  opportunities: [
    { key: 'name',        label: '商談名',     defaultOn: true },
    { key: 'account',     label: '取引先',     defaultOn: true },
    { key: 'stage',       label: 'ステージ',   defaultOn: true },
    { key: 'amount',      label: '金額',       defaultOn: true },
    { key: 'probability', label: '確度',       defaultOn: true },
    { key: 'close_date',  label: '完了予定日', defaultOn: true },
  ],
  activities: [
    { key: 'type',        label: '種別',   defaultOn: true },
    { key: 'subject',     label: '件名',   defaultOn: true },
    { key: 'account',     label: '取引先', defaultOn: true },
    { key: 'occurred_at', label: '日時',   defaultOn: true },
  ],
  tasks: [
    { key: 'title',    label: 'タイトル', defaultOn: true },
    { key: 'due_date', label: '期限',     defaultOn: true },
    { key: 'priority', label: '優先度',   defaultOn: true },
    { key: 'done',     label: '完了',     defaultOn: true },
    { key: 'account',  label: '取引先',   defaultOn: false },
  ],
  expenses: [
    { key: 'title',        label: '件名',     defaultOn: true },
    { key: 'amount',       label: '金額',     defaultOn: true },
    { key: 'category',     label: 'カテゴリ', defaultOn: true },
    { key: 'expense_date', label: '日付',     defaultOn: true },
    { key: 'account',      label: '取引先',   defaultOn: false },
    { key: 'notes',        label: '備考',     defaultOn: false },
  ],
  properties: [
    { key: 'name',             label: '物件名',     defaultOn: true },
    { key: 'property_type',    label: '物件種別',   defaultOn: true },
    { key: 'transaction_type', label: '取引種別',   defaultOn: true },
    { key: 'status',           label: 'ステータス', defaultOn: true },
    { key: 'price',            label: '価格',       defaultOn: true },
    { key: 'account',          label: '関連取引先', defaultOn: false },
  ],
}
