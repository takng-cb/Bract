/**
 * /approvals — 承認一覧（#85 Phase3 / REQ-0048）
 *
 * - 「自分が承認すべき」: 現在 step の承認者が自分で未判定の承認待ち。
 *   その場で承認/差戻しでき、レコードへのリンクも置く。
 * - 「自分の申請」: 自分が申請したもの。承認待ちは**取り下げ**できる。
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react'
import { getCurrentUserId } from '@/lib/auth'
import { getCurrentPermissions } from '@/lib/permissions'
import { listApprovalsForUser, getUserLabels, type ApprovalListItem } from '@/lib/approvals'
import { decideApproval, cancelApproval } from '@/app/actions/approvals'
import PageHeader from '@/components/ui/PageHeader'
import { getAppTimeZone } from '@/lib/systemSettings'
import { fmtDateTime } from '@/lib/datetime'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '承認待ち', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:  { label: '承認済み', cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: '差戻し',   cls: 'bg-red-50 text-red-600 border-red-200' },
  cancelled: { label: '取下げ',   cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

function ItemHead({ item, tz }: { item: ApprovalListItem; tz: string }) {
  return (
    <div className="min-w-0 flex-1">
      <Link href={item.href} className="text-sm font-semibold text-zinc-900 hover:text-blue-700 hover:underline">
        {item.recordLabel}
      </Link>
      <p className="mt-0.5 text-xs text-zinc-500">
        {item.bookLabel}
        {item.transition && <>・ステータス変更 <b>{item.transition.from || '—'}</b> → <b>{item.transition.to || '—'}</b></>}
        {item.totalSteps > 1 && <>・{item.currentStep}/{item.totalSteps} 段階目</>}
        <span className="ml-1 text-zinc-400">{fmtDateTime(item.requestedAt, tz)}</span>
      </p>
    </div>
  )
}

export default async function ApprovalsPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')
  const perms = await getCurrentPermissions()
  const { toDecide, mine } = await listApprovalsForUser(userId, perms.roleName)
  const requesterLabels = await getUserLabels(toDecide.map((i) => i.requestedBy))
  const tz = await getAppTimeZone()

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
      <PageHeader
        icon="🛡️"
        title="承認"
        description="自分が承認すべき申請と、自分が出した申請の状況"
      />

      {/* 自分が承認すべき */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-amber-500" strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-zinc-700">自分が承認すべき</h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{toDecide.length}</span>
        </div>
        {toDecide.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">承認待ちはありません</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {toDecide.map((item) => (
              <li key={item.approvalId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <ItemHead item={item} tz={tz} />
                <span className="text-xs text-zinc-400">申請: {requesterLabels[item.requestedBy] ?? '—'}</span>
                <form className="flex items-center gap-1.5">
                  <button
                    formAction={decideApproval.bind(null, item.approvalId, 'approved')}
                    className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    承認
                  </button>
                  <button
                    formAction={decideApproval.bind(null, item.approvalId, 'rejected')}
                    className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    差戻し
                  </button>
                </form>
                <Link href={item.href} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  詳細 <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 自分の申請 */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-zinc-400" strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-zinc-700">自分の申請</h2>
        </div>
        {mine.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">申請したものはありません</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {mine.map((item) => {
              const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending
              return (
                <li key={item.approvalId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ItemHead item={item} tz={tz} />
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  {item.status === 'pending' && (
                    <form action={cancelApproval.bind(null, item.approvalId)}>
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                      >
                        取り下げ
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
