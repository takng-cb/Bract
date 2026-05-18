/**
 * 整備の帳票一覧。
 *
 * URL slug は英語ベース。ラベルは日本語表示用。
 * 各帳票テンプレートは /maintenance/[id]/documents/[type] でレンダリング。
 */

export type DocumentType =
  | 'estimate-rough'   // 概算見積書
  | 'estimate'         // 見積書
  | 'work-order'       // 作業指示書
  | 'delivery-note'    // 納品書
  | 'invoice'          // 請求書
  | 'next-proposal'    // 次回整備提案書
  | 'intake-summary'   // 入庫概要シート
  | 'receipt'          // 領収証
  | 'custody'          // 預かり証
  | 'inspection-fees'  // 検査諸費用計算書
  | 'postcard'         // はがき宛名（車検案内）
  | 'application'      // 申請書類

export type DocumentMeta = {
  type:        DocumentType
  label:       string
  description: string
  icon?:       string
}

/** UI に表示する順序＝この配列順。 */
export const DOCUMENT_TYPES: DocumentMeta[] = [
  { type: 'estimate-rough',  label: '概算見積書',          description: '初期相談用の概算',           icon: '📝' },
  { type: 'estimate',        label: '見積書',              description: '正式な見積書',               icon: '📄' },
  { type: 'work-order',      label: '作業指示書',          description: '工場内向け・作業項目一覧',    icon: '🔧' },
  { type: 'delivery-note',   label: '納品書',              description: '納車時の納品書',             icon: '📦' },
  { type: 'invoice',         label: '請求書',              description: '請求書（振込先記載）',        icon: '💴' },
  { type: 'next-proposal',   label: '次回整備提案書',      description: '次回車検／点検の提案',         icon: '🗓️' },
  { type: 'intake-summary',  label: '入庫概要シート',      description: '入庫時の確認用シート',         icon: '📋' },
  { type: 'receipt',         label: '領収証',              description: '入金 1 件ごとに発行',          icon: '🧾' },
  { type: 'custody',         label: '預かり証',            description: '車両預かり時の証明書',          icon: '🔑' },
  { type: 'inspection-fees', label: '検査諸費用計算書',    description: '車検時の法定費用内訳',        icon: '🔬' },
  { type: 'postcard',        label: 'はがき宛名（車検案内）', description: '車検時期の案内ハガキ',     icon: '📮' },
  { type: 'application',     label: '申請書類',            description: '車検申請等の書類',             icon: '📑' },
]

/** type → meta */
export const DOCUMENT_META: Record<DocumentType, DocumentMeta> = Object.fromEntries(
  DOCUMENT_TYPES.map((d) => [d.type, d]),
) as Record<DocumentType, DocumentMeta>

export function isDocumentType(s: string): s is DocumentType {
  return s in DOCUMENT_META
}
