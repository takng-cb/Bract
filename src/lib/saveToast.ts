/**
 * 保存系トーストの遷移パラメータ（REQ-0057）。
 *
 * server action は保存成功後に redirect で詳細ページへ戻るため、クライアント側では
 * 完了を直接知れない。redirect 先 URL に `toast=<kind>.<nonce>` を付与し、
 * ToastHost（src/components/Toast.tsx）が検出してトースト表示→URL から除去する。
 * nonce は「同じページへの連続保存」でも searchParams の変化を起こすために付ける。
 */

export type SaveToastKind = 'created' | 'saved' | 'deleted'

export const SAVE_TOAST_MESSAGES: Record<SaveToastKind, string> = {
  created: '作成しました',
  saved:   '保存しました',
  deleted: '削除しました',
}

/** redirect 先 URL にトーストパラメータを付与する（server / client 両用の純関数） */
export function withSaveToast(path: string, kind: SaveToastKind): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}toast=${kind}.${Date.now().toString(36)}`
}
