'use client'

/**
 * グローバルトースト（REQ-0057）。
 *
 * 設定画面など「保存ボタンと結果メッセージが離れていて気付けない」問題への対応。
 * Provider 不要: どのクライアントコンポーネントからでも showToast() を呼ぶと、
 * (crm)/layout.tsx にマウントされた <ToastHost /> が画面下部中央に表示する
 * （window CustomEvent 経由。QuickLauncher の bract:quick-open と同じ作法）。
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { SAVE_TOAST_MESSAGES, type SaveToastKind } from '@/lib/saveToast'

export type ToastKind = 'success' | 'error'
type ToastItem = { id: number; message: string; kind: ToastKind }

const EVENT = 'bract:toast'
const DURATION_MS = 3500

/** どこからでも呼べるトースト表示（クライアント専用） */
export function showToast(message: string, kind: ToastKind = 'success') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }))
}

/**
 * useActionState 系フォームの「保存完了でトーストを出す」共通フック。
 * state の値が前回と同じ（'success' === 'success'）でも、pending の
 * true→false 遷移を見ることで2回目以降の保存でも発火する。
 *
 * 使い方:
 *   const [state, formAction, pending] = useActionState(action, null)
 *   useActionToast(pending, state, { success: '保存しました' })
 */
export function useActionToast(
  pending: boolean,
  state: string | null | undefined,
  messages: { success: string },
) {
  const prevPending = useRef(false)
  useEffect(() => {
    if (prevPending.current && !pending) {
      if (state === 'success') {
        showToast(messages.success)
      } else if (typeof state === 'string' && state.startsWith('error:')) {
        showToast(state.slice(6) || '保存に失敗しました', 'error')
      }
    }
    prevPending.current = pending
  }, [pending, state, messages.success])
}

/** トーストの描画ホスト（(crm)/layout.tsx に1つだけ置く。useSearchParams のため Suspense 内で） */
export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail
      const id = ++seq.current
      setItems((prev) => [...prev, { id, message, kind }])
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), DURATION_MS)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  // server action の redirect 経由の保存完了通知（?toast=<kind>.<nonce>、lib/saveToast.ts）。
  // 表示したら URL から除去する（リロードや共有で再表示されないように）。
  useEffect(() => {
    const raw = searchParams.get('toast')
    if (!raw) return
    const kind = raw.split('.')[0] as SaveToastKind
    const message = SAVE_TOAST_MESSAGES[kind]
    if (message) showToast(message)
    const url = new URL(window.location.href)
    url.searchParams.delete('toast')
    window.history.replaceState(null, '', url.toString())
  }, [searchParams])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-100 flex flex-col items-center gap-2 px-4 print:hidden" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg border animate-[toast-in_.2s_ease-out] ${
            t.kind === 'success'
              ? 'bg-zinc-900 text-white border-zinc-700'
              : 'bg-red-600 text-white border-red-500'
          }`}
        >
          {t.kind === 'success'
            ? <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-green-400" strokeWidth={2.25} aria-hidden />
            : <AlertCircle className="w-4.5 h-4.5 shrink-0" strokeWidth={2.25} aria-hidden />}
          <span className="max-w-[70vw] sm:max-w-md">{t.message}</span>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="閉じる"
            className="ml-1 opacity-60 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
