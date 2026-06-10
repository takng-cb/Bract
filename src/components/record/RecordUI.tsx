/**
 * レコード詳細ページ共通 UI（design_handoff / Bract Record Layout 準拠）。
 *
 * - サーバーコンポーネント（フックなし）。
 * - 2カラム（左=参照カード／右=タブパネル）、KPI サマリ帯、属性カード、ミニリスト、
 *   セマンティックバッジ、関連テーブルの見た目を統一する。
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

/* ── セマンティックバッジ ───────────────────────────────── */
export type BadgeTone = 'brand' | 'neutral' | 'warn' | 'info' | 'pos' | 'danger' | 'ai'

const BADGE_TONE: Record<BadgeTone, string> = {
  brand:   'bg-brand-50 text-brand-700 border-brand-200',
  neutral: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  warn:    'bg-amber-50 text-amber-700 border-amber-200',
  info:    'bg-sky-50 text-sky-700 border-sky-200',
  pos:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger:  'bg-rose-50 text-rose-700 border-rose-200',
  ai:      'bg-violet-50 text-violet-700 border-violet-200',
}

export function Badge({ tone = 'neutral', dot, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 text-[11.5px] font-semibold rounded-md border ${BADGE_TONE[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ── KPI サマリ帯 ───────────────────────────────────────── */
export type KpiItem = {
  icon?: ReactNode
  label: string
  value: ReactNode
  sub?: ReactNode
  subTone?: 'up' | 'down' | 'warn' | 'mut'
}

const KPI_SUB: Record<NonNullable<KpiItem['subTone']>, string> = {
  up:   'text-emerald-700',
  down: 'text-rose-700',
  warn: 'text-amber-700',
  mut:  'text-zinc-500',
}

const KPI_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
}

export function KpiBand({ items }: { items: KpiItem[] }) {
  if (items.length === 0) return null
  return (
    <div className={`grid gap-px bg-zinc-200 border border-zinc-200 rounded-xl overflow-hidden mb-5 ${KPI_COLS[items.length] ?? 'grid-cols-2 sm:grid-cols-4'}`}>
      {items.map((k, i) => (
        <div key={i} className="bg-white px-4 py-3 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
            {k.icon && <span className="text-zinc-400 [&_svg]:w-3.5 [&_svg]:h-3.5 shrink-0 inline-flex">{k.icon}</span>}
            <span className="truncate">{k.label}</span>
          </div>
          <div className="text-[21px] leading-tight font-bold text-zinc-900 tracking-tight mt-1 [&_small]:text-[13px] [&_small]:text-zinc-400 [&_small]:font-semibold truncate">{k.value}</div>
          {k.sub != null && <div className={`text-[11.5px] font-semibold mt-0.5 truncate ${KPI_SUB[k.subTone ?? 'mut']}`}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

/* ── 2カラムレイアウト ─────────────────────────────────── */
export function RecordColumns({ narrow, left, children }: { narrow?: boolean; left: ReactNode; children: ReactNode }) {
  return (
    <div className={`grid gap-5 items-start grid-cols-1 ${narrow ? 'lg:grid-cols-[380px_1fr]' : 'lg:grid-cols-[340px_1fr]'}`}>
      <div className="min-w-0 space-y-4">{left}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* ── 参照カード（タイトル＋本文） ───────────────────────── */
export function RefCard({ title, icon, action, children, bodyClassName }: { title: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; bodyClassName?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-xs">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-100">
        <span className="flex items-center gap-2 text-[13px] font-bold text-zinc-800 min-w-0">
          {icon && <span className="text-zinc-400 [&_svg]:w-[15px] [&_svg]:h-[15px] shrink-0 inline-flex">{icon}</span>}
          <span className="truncate">{title}</span>
        </span>
        {action}
      </div>
      <div className={bodyClassName ?? 'px-4 py-3.5'}>{children}</div>
    </div>
  )
}

/* ── ミニリスト（担当・連絡先・紐づくレコード） ─────────── */
export function MiniItem({ icon, iconClass, title, sub, href, right }: { icon: ReactNode; iconClass?: string; title: ReactNode; sub?: ReactNode; href?: string; right?: ReactNode }) {
  const inner = (
    <>
      <span className={`grid place-items-center w-7 h-7 rounded-md shrink-0 [&_svg]:w-[15px] [&_svg]:h-[15px] text-[12px] font-bold ${iconClass ?? 'bg-zinc-100 text-zinc-600'}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-zinc-900 truncate">{title}</span>
        {sub != null && <span className="block text-[11.5px] text-zinc-500 truncate">{sub}</span>}
      </span>
      {right && <span className="shrink-0 text-brand-700">{right}</span>}
    </>
  )
  return href ? (
    <Link href={href} className="flex items-center gap-2.5 py-2 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-md transition-colors">{inner}</Link>
  ) : (
    <div className="flex items-center gap-2.5 py-2 border-b border-zinc-100 last:border-0">{inner}</div>
  )
}

/* ── 関連テーブル ───────────────────────────────────────── */
export function RecordTable({ columns, children }: { columns: { label: ReactNode; num?: boolean }[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} className={`text-[11.5px] text-zinc-500 font-semibold px-4 py-2 bg-zinc-50 border-y border-zinc-200 ${c.num ? 'text-right' : 'text-left'}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

/** 関連テーブルの空表示 */
export function RecordTableEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-400 px-4 py-8 text-center">{children}</p>
}
