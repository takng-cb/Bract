import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'

/**
 * 商談パイプライン（カンバン）ビュー（REQ-0020 / design_handoff: Bract Opportunities）
 *
 * ステージ別カラムに商談カードを並べる。カードは詳細へリンク。
 * v1 はドラッグ＆ドロップ非対応（カラム見出しの集計・カードのリンクのみ）。
 */
export type BoardDeal = {
  id: string
  name: string
  accountName: string | null
  amount: number | null
  probability: number | null
  ownerChar: string
  closeDate: string | null
}
export type BoardColumn = {
  id: string
  label: string
  /** ドットの Tailwind 背景色クラス */
  dot: string
  deals: BoardDeal[]
  sum: number
}

/** ¥ をコンパクト表記（¥3.2M / ¥640K / ¥920） */
function compactYen(n: number): string {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000)     return `¥${Math.round(n / 1_000)}K`
  return `¥${n.toLocaleString()}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${Number(m[2])}/${Number(m[3])}` : d
}

export default function OpportunityBoard({ columns, canEdit }: { columns: BoardColumn[]; canEdit: boolean }) {
  return (
    <div className="flex gap-3.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8">
      {columns.map((col) => (
        <div key={col.id} className="w-72 shrink-0 flex flex-col">
          <div className="flex items-center gap-2 px-1 pb-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} aria-hidden />
            <span className="text-sm font-bold text-zinc-800">{col.label}</span>
            <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-px rounded-full tabular-nums">{col.deals.length}</span>
            <span className="ml-auto text-sm font-bold text-zinc-700 tabular-nums">{compactYen(col.sum)}</span>
          </div>

          <div className="flex flex-col gap-2.5 min-h-0">
            {col.deals.map((d) => (
              <Link
                key={d.id}
                href={`/opportunities/${d.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-3 shadow-xs hover:border-zinc-300 hover:shadow-sm transition-colors"
              >
                <div className="text-sm font-bold text-zinc-900 leading-snug">{d.name}</div>
                {d.accountName && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                    <Building2 className="w-3 h-3 shrink-0" strokeWidth={2.25} aria-hidden />
                    <span className="truncate">{d.accountName}</span>
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">{d.amount != null ? compactYen(d.amount) : '—'}</span>
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-brand-600 text-white text-[10px] font-bold" title="担当">{d.ownerChar}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-8 h-1 rounded bg-zinc-200 overflow-hidden inline-block align-middle">
                      <span className="block h-full bg-blue-500" style={{ width: `${d.probability ?? 0}%` }} />
                    </span>
                    <span className="tabular-nums">{d.probability ?? 0}%</span>
                  </span>
                  <span className="ml-auto tabular-nums">{fmtDate(d.closeDate)}</span>
                </div>
              </Link>
            ))}

            {canEdit && (
              <Link
                href={`/opportunities/new?stage=${col.id}`}
                className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />追加
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
