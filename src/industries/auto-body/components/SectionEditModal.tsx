'use client'

/**
 * 全体ビューの各セクションを **その場で（インラインで）** 編集するためのトグルシェル。
 *
 * - 以前は React Portal で全画面モーダルを開いていたが、#112（閲覧⇄編集トグル）の
 *   方針に合わせ、同じ位置に展開するインライン編集パネルへ変更した（ポップアップ廃止）。
 * - 中身の編集 UI は「保存」「キャンセル」を自前で持つ想定。保存後は
 *   `useSectionModal().close()` を呼んでパネルを閉じる（フックの API は従来と互換）。
 * - パネルは flex ヘッダ内で `basis-full` により全幅で折り返す。呼び出し側のヘッダ
 *   コンテナには `flex-wrap` を付けておくこと（付いていないと横に潰れる）。
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 編集 UI（フォーム）が「保存/キャンセル後に閲覧へ戻る」ために使う共有コンテキスト。
 * SectionEditModal（展開パネル）と InlineSection（カード内トグル）の両方が
 * この Provider を提供するので、各 *EditForm は実装を変えずどちらでも動く。
 */
export const SectionModalContext = createContext<{ close: () => void } | null>(null)

/** 編集 UI から呼ぶフック。パネル外では null。 */
export function useSectionModal(): { close: () => void } | null {
  return useContext(SectionModalContext)
}

type Props = {
  triggerLabel: ReactNode
  title: string
  children: ReactNode
  /** 後方互換のため受け取るが、インライン化により未使用。 */
  maxWidthClass?: string
}

export default function SectionEditModal({ triggerLabel, title, children }: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // 開いたらパネルを画面内へスクロール
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  // ESC で閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        {triggerLabel}
      </button>
    )
  }

  return (
    <SectionModalContext.Provider value={{ close }}>
      <div
        ref={panelRef}
        className="basis-full w-full mt-2 border border-blue-200 rounded-lg bg-white shadow-xs scroll-mt-20"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-blue-200 bg-blue-50/60 rounded-t-lg">
          <h4 className="text-sm font-semibold text-zinc-800">{title}</h4>
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
            aria-label="編集を閉じる"
          >
            × 閉じる
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </SectionModalContext.Provider>
  )
}
