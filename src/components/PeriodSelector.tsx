'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

type Props = {
  from: string  // YYYY-MM-DD
  to:   string  // YYYY-MM-DD
}

export default function PeriodSelector({ from, to }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [fromVal, setFromVal] = useState(from)
  const [toVal,   setToVal]   = useState(to)

  const go = (f: string, t: string) =>
    router.push(`${pathname}?from=${f}&to=${t}`)

  // 月ショートカット: 指定年月の初日〜末日に移動
  const now = new Date()
  const jumpToMonth = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const f = d.toISOString().slice(0, 10)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const t = lastDay.toISOString().slice(0, 10)
    setFromVal(f)
    setToVal(t)
    go(f, t)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 月ショートカット */}
      <div className="flex gap-1">
        {[
          { label: '先月', offset: -1 },
          { label: '今月', offset: 0 },
          { label: '来月', offset: 1 },
        ].map(({ label, offset }) => (
          <button
            key={offset}
            type="button"
            onClick={() => jumpToMonth(offset)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <span className="text-zinc-300">|</span>

      {/* 日付範囲 */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          onBlur={() => fromVal && toVal && go(fromVal, toVal)}
          className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-zinc-400">〜</span>
        <input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          onBlur={() => fromVal && toVal && go(fromVal, toVal)}
          className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => fromVal && toVal && go(fromVal, toVal)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          適用
        </button>
      </div>
    </div>
  )
}
