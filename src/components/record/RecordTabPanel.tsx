'use client'

/**
 * レコード詳細・右カラムのタブパネル（design_handoff 準拠）。
 * カード状の枠 + タブバー（下線アクティブ + 件数ピル）。各タブの中身は
 * サーバーで描画したものを ReactNode として受け取り、CSS で出し分ける。
 */
import { useState, type ReactNode } from 'react'

export type RecordTab = {
  id: string
  label: string
  icon?: ReactNode
  count?: number
  content: ReactNode
}

export default function RecordTabPanel({ tabs, defaultTab }: { tabs: RecordTab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
      <div className="flex gap-0.5 px-3 border-b border-zinc-200 bg-zinc-50 overflow-x-auto">
        {tabs.map((t) => {
          const on = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-3.5 py-3 -mb-px border-b-2 whitespace-nowrap transition-colors ${on ? 'text-brand-700 border-brand-600' : 'text-zinc-500 border-transparent hover:text-zinc-800'}`}
            >
              {t.icon && <span className="[&_svg]:w-4 [&_svg]:h-4 inline-flex">{t.icon}</span>}
              {t.label}
              {t.count != null && (
                <span className={`text-[11px] tabular-nums px-1.5 rounded-full font-semibold ${on ? 'bg-brand-100 text-brand-700' : 'bg-zinc-200 text-zinc-600'}`}>{t.count}</span>
              )}
            </button>
          )
        })}
      </div>
      <div>
        {tabs.map((t) => (
          <div key={t.id} className={active === t.id ? 'block' : 'hidden'}>{t.content}</div>
        ))}
      </div>
    </div>
  )
}
