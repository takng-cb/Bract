/**
 * 帳票印刷で使う発行元（自社）情報。
 *
 * 暫定としてダミー値を埋め込んでいる。将来的に settings テーブル＋管理画面で
 * 動的に上書きできるようにする想定。
 */
export const COMPANY_INFO = {
  name:        '株式会社サンプル板金 自動車整備工場',
  postal_code: '110-0001',
  address:     '東京都台東区谷中 1-2-3',
  phone:       '03-1234-5678',
  fax:         '03-1234-5679',
  email:       'info@sample-auto-body.example.jp',
  website:     'https://sample-auto-body.example.jp',
  // 国土交通省 自動車整備事業 認証番号など
  certificate_number: '関整認 第 1234 号',
  // 銀行口座情報（請求書用）
  bank_account: {
    bank:    'みらい銀行',
    branch:  '本店営業部',
    type:    '普通',
    number:  '1234567',
    holder:  'カ）サンプルバンキン',
  },
  // 領収証 印影（テキストで代用、実装段階）
  receipt_seal: '印',
} as const

export const CONSUMPTION_TAX_RATE = 10  // %
