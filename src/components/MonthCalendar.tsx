/**
 * 月間カレンダー（汎用・サーバーコンポーネント）— REQ-0039
 *
 * 日付つきイベントを月のグリッドに表示する。案件カレンダー等のビュー切替先として使う。
 * 前月/翌月の移動はリンク（?month=YYYY-MM を basePath に付与。persistParams を保持）。
 */
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type CalendarEvent = {
  /** YYYY-MM-DD */
  date: string
  href: string
  label: string
  /** バッジ色（tailwind クラス。例: assignmentStatusColor の戻り値） */
  className?: string
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

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
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
          return (
            <div key={day} className="min-h-24 border-b border-r border-zinc-100 p-1 align-top last:border-r-0">
              <p className={`mb-1 text-[11px] font-semibold leading-none ${isToday ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white' : weekday === 0 ? 'text-rose-500' : weekday === 6 ? 'text-blue-500' : 'text-zinc-500'}`}>
                {day}
              </p>
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_PER_DAY).map((e, j) => (
                  <Link
                    key={j}
                    href={e.href}
                    title={e.label}
                    className={`block truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:opacity-80 ${e.className ?? 'bg-blue-50 text-blue-700'}`}
                  >
                    {e.label}
                  </Link>
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
