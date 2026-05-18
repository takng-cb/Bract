'use client'

/**
 * 全体ビューの各セクションを編集するためのモーダルシェル。
 *
 * - トリガーボタン + モーダル開閉
 * - 中身の編集 UI は「保存」「キャンセル」ボタンを自前で持つことを想定
 * - 中身からは useSectionModal() で `close()` を呼んでモーダルを閉じる
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const ModalContext = createContext<{ close: () => void } | null>(null)

/** モーダル内の編集 UI から呼ぶフック。モーダル外では null。 */
export function useSectionModal(): { close: () => void } | null {
  return useContext(ModalContext)
}

type Props = {
  triggerLabel: ReactNode
  title: string
  children: ReactNode
  maxWidthClass?: string
}

export default function SectionEditModal({
  triggerLabel,
  title,
  children,
  // ほぼ全画面：左右 16px の余白だけ残してビューポート 100% に近い幅・高さ
  maxWidthClass = 'max-w-[calc(100vw-2rem)]',
}: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  // モーダル開時は背景スクロール抑止
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  // ESC で閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:underline"
      >
        {triggerLabel}
      </button>

      {open && (
        <ModalContext.Provider value={{ close }}>
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 backdrop-blur-[2px] p-2 sm:p-4 overflow-y-auto"
            onClick={close}
          >
            <div
              className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClass} h-[calc(100vh-2rem)] sm:h-[calc(100vh-2rem)] flex flex-col`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              {/* sticky ヘッダー */}
              <div className="sticky top-0 bg-white border-b border-zinc-200 px-5 py-3 flex items-center justify-between rounded-t-lg z-10">
                <h2 className="text-base font-semibold text-zinc-800">{title}</h2>
                <button
                  type="button"
                  onClick={close}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-2xl leading-none"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              {/* 本文（中身が自前で 保存/キャンセル のフッタを持つ想定） */}
              <div className="flex-1 overflow-y-auto p-5">
                {children}
              </div>
            </div>
          </div>
        </ModalContext.Provider>
      )}
    </>
  )
}
