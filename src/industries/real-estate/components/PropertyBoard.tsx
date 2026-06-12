import Link from 'next/link'
import { MapPin, Plus } from 'lucide-react'

/**
 * 物件パイプライン（カンバン）ビュー（REQ-0067）。
 *
 * ステータス別カラムに物件カードを並べる。見た目・作法は OpportunityBoard に揃える
 * （カラム見出し=ドット＋件数＋価格合計、終端列の表示ウィンドウ注記、カードは詳細へリンク）。
 * v1 はドラッグ＆ドロップ非対応。
 */
export type BoardProperty = {
  id: string
  name: string
  address: string | null
  propertyType: string | null
  transactionType: string | null
  price: number | null
}

export type PropertyBoardColumn = {
  id: string
  label: string
  /** ドットの Tailwind 背景色クラス */
  dot: string
  items: BoardProperty[]
  sum: number
  /** 終端列の表示ウィンドウ注記（例: 直近3ヶ月 ・ 全120件中24件。REQ-0044） */
  windowNote?: string
  /** 全件を見るリンク（ステータスで絞ったリストビュー） */
  moreHref?: string
}

/** ¥ をコンパクト表記（¥62M / ¥640K / ¥920） */
function compactYen(n: number): string {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000)     return `¥${Math.round(n / 1_000)}K`
  return `¥${n.toLocaleString()}`
}

export default function PropertyBoard({ columns, canEdit, newHrefBase }: {
  columns: PropertyBoardColumn[]
  canEdit: boolean
  /** 「追加」リンクの基点（例: /properties/new?view=real_estate） */
  newHrefBase: string
}) {
  return (
    <div className="flex gap-3.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8">
      {columns.map((col) => (
        <div key={col.id} className="w-72 shrink-0 flex flex-col">
          <div className="flex items-center gap-2 px-1 pb-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} aria-hidden />
            <span className="text-sm font-bold text-zinc-800">{col.label}</span>
            <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-px rounded-full tabular-nums">{col.items.length}</span>
            <span className="ml-auto text-sm font-bold text-zinc-700 tabular-nums">{compactYen(col.sum)}</span>
          </div>

          {/* 終端列の表示ウィンドウ注記（REQ-0044） */}
          {col.windowNote && (
            <p className="px-1 -mt-1.5 pb-2 text-[11px] text-zinc-400">
              {col.windowNote}
              {col.moreHref && <Link href={col.moreHref} className="ml-1.5 text-blue-600 hover:underline">すべて見る →</Link>}
            </p>
          )}

          <div className="flex flex-col gap-2.5 min-h-0">
            {col.items.map((p) => (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-3 shadow-xs hover:border-zinc-300 hover:shadow-sm transition-colors"
              >
                <div className="text-sm font-bold text-zinc-900 leading-snug">{p.name}</div>
                {p.address && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                    <MapPin className="w-3 h-3 shrink-0" strokeWidth={2.25} aria-hidden />
                    <span className="truncate">{p.address}</span>
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">{p.price != null ? compactYen(p.price) : '—'}</span>
                  <span className="flex items-center gap-1 min-w-0">
                    {p.propertyType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 truncate">{p.propertyType}</span>}
                    {p.transactionType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 shrink-0">{p.transactionType}</span>}
                  </span>
                </div>
              </Link>
            ))}

            {canEdit && (
              <Link
                href={newHrefBase}
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
