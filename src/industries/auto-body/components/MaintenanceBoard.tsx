import Link from 'next/link'
import { Building2, UserRound, TriangleAlert } from 'lucide-react'

/**
 * 整備カンバン（ステータス別）ビュー（REQ-0020 / design_handoff: Bract Maintenance）
 *
 * ステータス列（予約/受付/作業中/部品待ち/納車待ち/完了）に整備ジョブカードを並べる。
 * カードは整備詳細へリンク。v1 はドラッグ＆ドロップ非対応。
 */
export type BoardJob = {
  id: string
  plate: string
  vehicleName: string
  customer: string | null
  isPersonal: boolean
  work: string | null
  branch: string | null
  eta: string | null
  mechChar: string
  over: boolean
}
export type BoardColumn = {
  status: string
  /** アクセント／ドットの色（hex） */
  color: string
  badgeBg: string
  badgeText: string
  jobs: BoardJob[]
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${Number(m[2])}/${Number(m[3])}` : d
}

export default function MaintenanceBoard({ columns }: { columns: BoardColumn[] }) {
  return (
    <div className="flex gap-3.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8">
      {columns.map((col) => (
        <div key={col.status} className="w-72 shrink-0 flex flex-col">
          <div className="flex items-center gap-2 px-1 pb-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} aria-hidden />
            <span className="text-sm font-bold text-zinc-800">{col.status}</span>
            <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-px rounded-full tabular-nums">{col.jobs.length}</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {col.jobs.map((j) => (
              <Link
                key={j.id}
                href={`/maintenance/${j.id}`}
                className="flex rounded-md border border-zinc-200 bg-white shadow-xs hover:shadow-sm transition-shadow overflow-hidden"
              >
                <span className="w-1 shrink-0" style={{ background: col.color }} aria-hidden />
                <div className="flex-1 min-w-0 p-3">
                  <div className="font-mono text-xs text-zinc-500">{j.plate}</div>
                  <div className="text-sm font-bold text-zinc-900 mt-0.5 mb-0.5 truncate">{j.vehicleName}</div>
                  {j.customer && (
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      {j.isPersonal
                        ? <UserRound className="w-3 h-3 shrink-0" strokeWidth={2.25} aria-hidden />
                        : <Building2 className="w-3 h-3 shrink-0" strokeWidth={2.25} aria-hidden />}
                      <span className="truncate">{j.customer}</span>
                    </div>
                  )}
                  {j.work && (
                    <div className="mt-2">
                      <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${col.badgeBg} ${col.badgeText}`}>{j.work}</span>
                    </div>
                  )}
                  <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center gap-2 text-xs text-zinc-500">
                    {j.branch && <span className="font-bold text-zinc-700">{j.branch}</span>}
                    <span className={`inline-flex items-center gap-1 ${j.over ? 'text-red-600 font-semibold' : ''}`}>
                      {j.over && <TriangleAlert className="w-3 h-3 shrink-0" strokeWidth={2.25} aria-hidden />}
                      {fmtDate(j.eta)}
                    </span>
                    <span className="ml-auto grid place-items-center w-5.5 h-5.5 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-bold" title="作業担当">{j.mechChar}</span>
                  </div>
                </div>
              </Link>
            ))}
            {col.jobs.length === 0 && (
              <p className="text-xs text-zinc-300 px-1 py-3">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
