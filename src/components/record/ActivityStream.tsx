'use client'

/**
 * アクティビティのタイムライン（design_handoff 準拠）。
 * 活動 / ToDo / 経費 / 履歴 / メモ を1本の時系列に統合し、フィルタチップで絞り込む。
 * 各イベントの中身（リンク・チェックボックス等）はサーバーで描画して渡す。
 */
import { useState, type ReactNode } from 'react'

export type StreamKind = 'act' | 'todo' | 'exp' | 'his' | 'note'

export type StreamEvent = {
  id: string
  kind: StreamKind
  typeLabel: string
  who?: string
  time?: string
  day: string
  /** ToDo のチェックボックス等、本文左に置く要素 */
  leading?: ReactNode
  body: ReactNode
}

const KIND_META: Record<StreamKind, { label: string; ty: string; dot: string }> = {
  act:  { label: '活動', ty: 'bg-sky-50 text-sky-700',       dot: 'bg-sky-50 border-sky-200 text-sky-700' },
  todo: { label: 'ToDo', ty: 'bg-brand-50 text-brand-700',   dot: 'bg-brand-50 border-brand-200 text-brand-700' },
  exp:  { label: '経費', ty: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-50 border-amber-200 text-amber-700' },
  his:  { label: '履歴', ty: 'bg-zinc-100 text-zinc-600',    dot: 'bg-zinc-100 border-zinc-200 text-zinc-600' },
  note: { label: 'メモ', ty: 'bg-violet-50 text-violet-700', dot: 'bg-violet-50 border-violet-200 text-violet-700' },
}

const FILTER_ORDER: StreamKind[] = ['act', 'todo', 'exp', 'his', 'note']

export default function ActivityStream({ events, composer }: { events: StreamEvent[]; composer?: ReactNode }) {
  const [filter, setFilter] = useState<'all' | StreamKind>('all')

  const counts: Record<string, number> = { all: events.length }
  for (const e of events) counts[e.kind] = (counts[e.kind] ?? 0) + 1
  const presentKinds = FILTER_ORDER.filter((k) => counts[k])

  const shown = filter === 'all' ? events : events.filter((e) => e.kind === filter)

  // 連続する同日でグルーピング
  const groups: { day: string; items: StreamEvent[] }[] = []
  for (const e of shown) {
    const last = groups[groups.length - 1]
    if (last && last.day === e.day) last.items.push(e)
    else groups.push({ day: e.day, items: [e] })
  }

  return (
    <div>
      {composer}
      {presentKinds.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-100 flex-wrap">
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>すべて <span className="text-[11px] opacity-70">{counts.all}</span></Chip>
          {presentKinds.map((k) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{KIND_META[k].label} <span className="text-[11px] opacity-70">{counts[k]}</span></Chip>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-zinc-400 px-4 py-10 text-center">記録がありません</p>
      ) : (
        <div className="relative px-4 pb-4 pt-1.5">
          <span className="absolute left-[31px] top-3 bottom-3 w-px bg-zinc-200" aria-hidden />
          {groups.map((g, gi) => (
            <div key={gi}>
              <div className="text-[11.5px] font-bold text-zinc-500 pt-3.5 pb-2 pl-9 tracking-wide">{g.day}</div>
              {g.items.map((e) => {
                const m = KIND_META[e.kind]
                return (
                  <div key={e.id} className="relative pl-9 pb-3.5">
                    <span className={`absolute left-1.5 top-0.5 w-6 h-6 rounded-full grid place-items-center border z-[1] [&_svg]:w-3 [&_svg]:h-3 ${m.dot}`}>{streamIcon(e.kind)}</span>
                    <div className="bg-white border border-zinc-200 rounded-md px-3 py-2.5 hover:border-zinc-300 transition-colors">
                      {e.leading ? (
                        <div className="flex items-start gap-2.5">
                          <div className="shrink-0 pt-0.5">{e.leading}</div>
                          <div className="flex-1 min-w-0">
                            <EvHead m={m} e={e} />
                            <div className="text-[13.5px] text-zinc-800">{e.body}</div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <EvHead m={m} e={e} />
                          <div className="text-[13.5px] text-zinc-800">{e.body}</div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EvHead({ m, e }: { m: { ty: string }; e: StreamEvent }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className={`text-[11px] font-bold px-1.5 py-px rounded ${m.ty}`}>{e.typeLabel}</span>
      {e.who && <span className="text-xs text-zinc-600 font-semibold">{e.who}</span>}
      {e.time && <span className="text-[11.5px] text-zinc-400 ml-auto">{e.time}</span>}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[27px] px-2.5 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400'}`}
    >
      {children}
    </button>
  )
}

function streamIcon(kind: StreamKind): ReactNode {
  // 単純な点（種別色は枠で表現）。アイコンは省略して軽量に。
  if (kind === 'todo') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  if (kind === 'exp') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /></svg>
  if (kind === 'his') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
  if (kind === 'note') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
}
