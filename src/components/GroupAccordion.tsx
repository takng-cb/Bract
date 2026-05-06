'use client'

import { useState } from 'react'

type Props = {
  label: string
  count: number
  depth: number
  children: React.ReactNode
}

const INDENT = ['', 'ml-3 border-l-2 border-zinc-200 pl-3', 'ml-6 border-l-2 border-zinc-100 pl-3']

/**
 * モバイルグルーピング用の開閉アコーディオン（クライアント側状態のみ担当）。
 * カード内容はサーバーコンポーネントが children として渡す。
 */
export default function GroupAccordion({ label, count, depth, children }: Props) {
  const [open, setOpen] = useState(true)
  const indentClass = INDENT[Math.min(depth, INDENT.length - 1)]

  return (
    <div className={`mb-2 ${indentClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-zinc-100 rounded-lg text-sm font-semibold text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
      >
        <span className="text-zinc-400 text-xs w-3 shrink-0">{open ? '▼' : '▶'}</span>
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="shrink-0 text-xs font-normal text-zinc-400 tabular-nums">{count} 件</span>
      </button>
      {open && <div className="mt-1.5 space-y-1.5">{children}</div>}
    </div>
  )
}
