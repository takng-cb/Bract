'use client'

/**
 * 整備「全体」ビューのフィールド系セクション（整備 / 顧客・車両 / 代車 / 請求・支払 / 損傷）を、
 * 他ブックのインライン編集（EditableInfoCard）と同じ作法でトグルするカード。
 *
 * - 既定は閲覧（`view`）。右上「編集」で同じカード内が編集フォーム（`children`）に切替。
 * - SectionEditModal のような「閲覧の下に別パネルを展開」ではなく、閲覧を隠して
 *   その場でフォームに置き換える（= 他ブック踏襲）。
 * - フォーム側は従来どおり `useSectionModal()` の `close()` を呼べば閲覧へ戻る
 *   （SectionModalContext を本コンポーネントが提供する）。保存/キャンセルは各フォームが持つ。
 */
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { SquarePen, X } from 'lucide-react'
import { SectionModalContext } from './SectionEditModal'

export default function InlineSection({
  title,
  icon,
  canEdit,
  view,
  children,
  className = '',
}: {
  title: ReactNode
  icon?: ReactNode
  canEdit: boolean
  /** 閲覧モードの中身 */
  view: ReactNode
  /** 編集フォーム（保存/キャンセルを自前で持つ）。未指定なら編集不可 */
  children?: ReactNode
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setEditing(false)
  const editable = canEdit && !!children

  useEffect(() => {
    if (editing) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [editing])

  // ESC で編集を閉じる
  useEffect(() => {
    if (!editing) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editing])

  return (
    <section
      ref={ref}
      className={`bg-white border ${editing ? 'border-brand-300' : 'border-zinc-200'} rounded-lg shadow-xs scroll-mt-20 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-100">
        <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="truncate">{title}</span>
          {editing && <span className="ml-1 text-[11px] font-normal text-brand-600 shrink-0">編集中</span>}
        </h2>
        {editable && (
          editing ? (
            <button
              type="button"
              onClick={close}
              aria-label="編集を閉じる"
              className="text-zinc-400 hover:text-zinc-700 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 shrink-0"
            >
              <SquarePen className="w-3.5 h-3.5" strokeWidth={2.25} />編集
            </button>
          )
        )}
      </div>
      <div className="p-4">
        {editing
          ? <SectionModalContext.Provider value={{ close }}>{children}</SectionModalContext.Provider>
          : view}
      </div>
    </section>
  )
}
