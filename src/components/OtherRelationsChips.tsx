import Link from 'next/link'
import type { ResolvedRecord } from '@/lib/relatedRecords'
import { NavIcon } from '@/lib/navIcon'

/**
 * 活動・ToDo・経費の各アイテムに「他にどのレコードに紐づいているか」を
 * 小さなチップで表示する補助コンポーネント。
 *
 * 使い方:
 *   const others = (activityRelMap.get(a.id) ?? [])
 *     .filter(r => !(r.object_api === 'account' && r.record_id === currentAccountId))
 *   <OtherRelationsChips relations={others} />
 *
 * 空配列なら何も描画しない。
 */
export default function OtherRelationsChips({ relations }: { relations: ResolvedRecord[] }) {
  if (relations.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {relations.map((r, i) => (
        <Link
          key={`${r.object_api}-${r.record_id}-${i}`}
          href={r.href}
          className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 transition-colors"
        >
          <NavIcon icon={r.icon} className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[10rem]">{r.label}</span>
        </Link>
      ))}
    </div>
  )
}
