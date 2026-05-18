'use client'

/**
 * 全体ビュー（MaintenanceFullView）の各セクションに付ける「✏️ 編集」ボタン。
 * クリックでモーダルが開き、その中で 既存の編集 UI（行アイテム / 諸費用 / 入金 /
 * 損傷マップ）を使ってインラインで 追加・編集・削除 できる。
 *
 * Next.js のパターン: client component に server component を `children` として
 * 渡すことができる。中身（編集 UI）は既に server 側で render 済みなので、モーダル
 * を開くだけで即座に表示される。
 *
 * 編集操作は中の編集 UI が `revalidatePath` を呼ぶので、モーダルを閉じれば全体
 * ビューが最新データに更新される。
 */
import { useState, useEffect, type ReactNode } from 'react'

type Props = {
  /** トリガーボタンのラベル（例: '✏️ 編集'） */
  triggerLabel: ReactNode
  /** モーダル上部に出すタイトル（例: '作業項目を編集'） */
  title: string
  /** モーダル内に表示する編集 UI（server component を渡す） */
  children: ReactNode
  /** 任意: モーダルの最大幅 (Tailwind class)。デフォルト 'max-w-5xl' */
  maxWidthClass?: string
}

export default function SectionEditModal({
  triggerLabel,
  title,
  children,
  maxWidthClass = 'max-w-5xl',
}: Props) {
  const [open, setOpen] = useState(false)

  // モーダルが開いている間、背景スクロールを止める
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  // ESC キーで閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
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
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-2 sm:p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClass} my-4 sm:my-0 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* sticky ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-5 py-3 flex items-center justify-between z-10">
              <h2 className="text-base font-semibold text-zinc-800">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-2xl leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            {/* 本文 */}
            <div className="p-5 space-y-3">
              {children}
            </div>

            {/* sticky フッター */}
            <div className="sticky bottom-0 bg-zinc-50 border-t border-zinc-200 px-5 py-3 flex items-center justify-end gap-2">
              <p className="text-xs text-zinc-500 mr-auto">編集内容は即時保存されます</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 shadow-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
