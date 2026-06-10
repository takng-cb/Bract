'use client'

/**
 * 関連情報タブのセグメント切替（design_handoff 準拠）。
 * 商談 / 人物 / 添付 などをセグメントボタンで切り替えて、それぞれのテーブルを表示する。
 */
import { useState, type ReactNode } from 'react'

export type RelatedSegment = {
  id: string
  label: string
  icon?: ReactNode
  count?: number
  content: ReactNode
}

export default function RelatedSegments({ segments, defaultSeg }: { segments: RelatedSegment[]; defaultSeg?: string }) {
  const [active, setActive] = useState(defaultSeg ?? segments[0]?.id)
  return (
    <div>
      <div className="flex gap-0.5 px-4 pt-3 flex-wrap">
        {segments.map((s) => {
          const on = active === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-2.5 py-1.5 rounded-md transition-colors ${on ? 'bg-brand-50 text-brand-700' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'}`}
            >
              {s.icon && <span className="[&_svg]:w-3.5 [&_svg]:h-3.5 inline-flex">{s.icon}</span>}
              {s.label}
              {s.count != null && <span className="text-[11px] text-zinc-400">{s.count}</span>}
            </button>
          )
        })}
      </div>
      <div className="pb-2">
        {segments.map((s) => (
          <div key={s.id} className={active === s.id ? 'block' : 'hidden'}>{s.content}</div>
        ))}
      </div>
    </div>
  )
}
