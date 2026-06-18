/**
 * AI作成の関連先まわりの共有型・定数（REQ-0085 / ADR-0030）。
 * サーバ('use server' quickAi.ts)・クライアント(QuickLauncher 等)の双方から import するため、
 * 'use server' でない純粋モジュールに置く（'use server' は async 関数しか export できない）。
 */

/** 関連先の値。既存レコード参照、または「新規作成」の予約（確定時に作成＝materialize）。 */
export type RelatedRef =
  | { mode: 'existing'; object_api: string; record_id: string; label: string; kind: string }
  | { mode: 'new'; object_api: string; name: string; kind: string }

/** 「新規作成」に対応する関連先の型（名前1カラムで作れる標準型）→ ブック api（複数）。 */
export const NEW_RELATED_TYPES: { object_api: string; kind: string; book: string }[] = [
  { object_api: 'account',     kind: '取引先',       book: 'accounts' },
  { object_api: 'contact',     kind: '人物',         book: 'contacts' },
  { object_api: 'opportunity', kind: '商談',         book: 'opportunities' },
  { object_api: 'project',     kind: 'プロジェクト', book: 'projects' },
]
