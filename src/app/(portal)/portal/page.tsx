/**
 * /portal — 外部ユーザーに共有されたレコード一覧（REQ-0084・Phase2）。
 * 自分宛ての有効な record_grants のみを表示。読み取り専用。
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Inbox } from 'lucide-react'
import { getSupabaseUser } from '@/lib/auth'
import { listGrantsForUser } from '@/lib/recordGrants'
import { resolveRelatedRecords } from '@/lib/relatedRecords'

export default async function PortalHome() {
  const user = await getSupabaseUser()
  if (!user) redirect('/login')

  const grants = await listGrantsForUser(user.id)
  const resolved = await resolveRelatedRecords(grants.map((g) => ({ object_api: g.object_api, record_id: g.record_id })))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-zinc-900">共有されたレコード</h1>
        <p className="mt-1 text-sm text-zinc-500">あなたに共有された情報の一覧です。閲覧のみ可能です。</p>
      </div>

      {resolved.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center text-zinc-400">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-zinc-300" strokeWidth={1.75} aria-hidden />
          <p className="text-sm">共有されたレコードはありません</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {resolved.map((r) => (
            <li key={`${r.object_api}::${r.record_id}`}>
              <Link
                href={`/portal/${r.object_api}/${r.record_id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-zinc-50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="text-lg">{r.icon}</span>
                  <span className="truncate font-medium text-zinc-800">{r.label}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
