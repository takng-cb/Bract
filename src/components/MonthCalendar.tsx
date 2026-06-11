'use client'

/**
 * 月間カレンダー（汎用）— REQ-0039 / REQ-0043
 *
 * 日付つきイベントを月のグリッドに表示する。案件・整備・ToDo・商談・活動のビュー切替先として使う。
 * - イベントのチップをクリックすると**概要ポップオーバー**を表示（即遷移しない）。
 *   ポップオーバー内の「詳細ページへ →」リンクから遷移する（REQ-0043）。
 * - 前月/翌月の移動はリンク（?month=YYYY-MM を basePath に付与。persistParams を保持）。
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react'

export type CalendarEvent = {
  /** YYYY-MM-DD */
  date: string
  href: string
  label: string
  /** バッジ色（tailwind クラス。例: assignmentStatusColor の戻り値） */
  className?: string
  /** ポップオーバーに出す概要（ラベル: 値 の行） */
  details?: { label: string; value: string }[]
}

type Props = {
  /** 表示する月（1-12） */
  year: number
  month: number
  events: CalendarEvent[]
  basePath: string
  /** 前月/翌月リンクに保持するクエリ（view=calendar や f 等） */
  persistParams?: Record<string, string | string[]>
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MAX_PER_DAY = 3

function monthHref(basePath: string, y: number, m: number, persist?: Props['persistParams']): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(persist ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x))
    else if (v) params.set(k, v)
  }
  params.set('month', `${y}-${String(m).padStart(2, '0')}`)
  return `${basePath}?${params.toString()}`
}

/** イベントチップ＋クリックで概要ポップオーバー（詳細リンクつき） */
function EventChip({ event, openUp, alignRight }: { event: CalendarEvent; openUp: boolean; alignRight: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={event.label}
        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:opacity-80 ${event.className ?? 'bg-blue-50 text-blue-700'}`}
      >
        {event.label}
      </button>

      {open && (
        <div
          className={`absolute z-40 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${alignRight ? 'right-0' : 'left-0'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900 wrap-break-word">{event.label}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="shrink-0 text-zinc-300 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {event.details && event.details.length > 0 && (
            <dl className="mt-2 space-y-1">
              {event.details.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <dt className="w-16 shrink-0 text-zinc-400">{d.label}</dt>
                  <dd className="flex-1 wrap-break-word text-zinc-700">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link
            href={event.href}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            詳細ページへ <ArrowRight className="w-3 h-3" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  )
}

export default function MonthCalendar({ year, month, events, basePath, persistParams }: Props) {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingBlanks = first.getDay() // 日曜はじまり
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const eventsByDay = new Map<number, CalendarEvent[]>()
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  for (const e of events) {
    if (!e.date?.startsWith(prefix)) continue
    const day = Number(e.date.slice(8, 10))
    if (!Number.isFinite(day)) continue
    if (!eventsByDay.has(day)) eventsByDay.set(day, [])
    eventsByDay.get(day)!.push(e)
  }

  const prevY = month === 1 ? year - 1 : year
  const prevM = month === 1 ? 12 : month - 1
  const nextY = month === 12 ? year + 1 : year
  const nextM = month === 12 ? 1 : month + 1

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const totalRows = cells.length / 7

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-visible">
      {/* 月ヘッダ */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 bg-zinc-50/60">
        <Link href={monthHref(basePath, prevY, prevM, persistParams)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100" aria-label="前月">
          <ChevronLeft className="w-4 h-4" strokeWidth={2.25} aria-hidden />前月
        </Link>
        <p className="text-sm font-bold text-zinc-900">{year}年{month}月</p>
        <Link href={monthHref(basePath, nextY, nextM, persistParams)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100" aria-label="翌月">
          翌月<ChevronRight className="w-4 h-4" strokeWidth={2.25} aria-hidden />
        </Link>
      </div>

      {/* 曜日ヘッダ */}
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-1.5 text-[11px] font-semibold ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-zinc-500'}`}>{w}</div>
        ))}
      </div>

      {/* 日グリッド */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b-${i}`} className="min-h-24 border-b border-r border-zinc-100 bg-zinc-50/40 last:border-r-0" />
          const dateStr = `${prefix}${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const dayEvents = eventsByDay.get(day) ?? []
          const weekday = i % 7
          const row = Math.floor(i / 7)
          // 端のセルはポップオーバーがはみ出さない向きに開く
          const openUp = row >= totalRows - 1 && totalRows > 1
          const alignRight = weekday >= 4
          return (
            <div key={day} className="relative min-h-24 border-b border-r border-zinc-100 p-1 align-top last:border-r-0">
              <p className={`mb-1 text-[11px] font-semibold leading-none ${isToday ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white' : weekday === 0 ? 'text-rose-500' : weekday === 6 ? 'text-blue-500' : 'text-zinc-500'}`}>
                {day}
              </p>
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_PER_DAY).map((e, j) => (
                  <EventChip key={j} event={e} openUp={openUp} alignRight={alignRight} />
                ))}
                {dayEvents.length > MAX_PER_DAY && (
                  <p className="px-1 text-[10px] text-zinc-400">他 {dayEvents.length - MAX_PER_DAY} 件</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
