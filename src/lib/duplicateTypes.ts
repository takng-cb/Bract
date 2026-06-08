/**
 * レコード新規作成時の「重複検出 → 確認画面」共通型（REQ-0018 / ADR-0013）
 *
 * クライアント(フォーム)とサーバー(create アクション)の双方が import するため、
 * DB 依存を一切持たない純粋な型のみをここに置く（client-safe）。
 *
 * 既存フォームは `useActionState<string|null>`（エラー文字列 or null=成功でredirect）だった。
 * これを `CreateState` に置き換え、成功時は redirect、重複時は確認 UI、エラー時は赤帯、という
 * 3 状態を 1 つの戻り値で表現する。
 */

/** 確認画面に出す既存レコード候補 */
export type DupCandidate = {
  id: string
  label: string   // 表示名（取引先名・氏名・商談名・案件タイトル 等）
  href: string    // 既存レコードへのリンク
}

/** create アクションの戻り値（= フォームの useActionState state） */
export type CreateState =
  | null                                                              // 成功（呼び出し側で redirect 済み）
  | { kind: 'error'; message: string }                               // バリデーション/保存エラー
  | { kind: 'duplicate'; objectLabel: string; candidates: DupCandidate[] }  // 同名/同一の既存あり

/** フォーム側 action prop の共通シグネチャ */
export type CreateAction = (prev: CreateState, formData: FormData) => Promise<CreateState>
