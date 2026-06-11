/**
 * レコード詳細の承認セクション（REQ-0023 / ADR-0022 / #85 Phase1）
 *
 * サーバーコンポーネント。対象ブックの承認設定にマッチしない＆申請履歴も無い場合は何も描画しない。
 * 申請/承認/差戻し/取消はすべて <form action> の Server Action（クライアント JS 不要）。
 */
import { getCurrentUserId } from '@/lib/auth'
import { getCurrentPermissions } from '@/lib/permissions'
import {
  getLatestApproval,
  resolveRoute,
  routeFromSnapshot,
  getUserLabels,
  approverEntryLabel,
  userIdsInRoute,
} from '@/lib/approvals'
import { canDecideStep } from '@/lib/approvalRules'
import { requestApproval, decideApproval, cancelApproval } from '@/app/actions/approvals'
import { ShieldCheck, ShieldAlert, ShieldQuestion, Undo2 } from 'lucide-react'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '承認待ち', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:  { label: '承認済み', cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: '差戻し',   cls: 'bg-red-50 text-red-600 border-red-200' },
  cancelled: { label: '取消',     cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

export default async function ApprovalSection({ objectType, objectId }: { objectType: string; objectId: string }) {
  const [route, latest, userId, perms] = await Promise.all([
    resolveRoute(objectType, objectId),
    getLatestApproval(objectType, objectId),
    getCurrentUserId(),
    getCurrentPermissions(),
  ])

  // 承認対象でなく、申請履歴も無ければセクションごと非表示
  if (!route && !latest) return null
  if (!userId) return null

  const approval = latest?.approval ?? null
  const decisions = latest?.decisions ?? []
  const snapshotRoute = approval ? routeFromSnapshot(approval.route_snapshot) : []

  // 表示名解決（申請者・判定者・ルート内の user: エントリ）
  const labelIds = [
    ...(approval ? [approval.requested_by] : []),
    ...decisions.map((d) => d.approver_id),
    ...userIdsInRoute(snapshotRoute),
    ...userIdsInRoute(route ?? []),
  ]
  const userLabels = await getUserLabels(labelIds)

  const pending = approval?.status === 'pending'
  const currentStep = approval?.current_step ?? 0
  const stepDef = pending ? snapshotRoute[currentStep - 1] : undefined
  const canDecide = !!(pending && stepDef && canDecideStep(
    stepDef, currentStep,
    decisions.map((d) => ({ step: d.step, approver_id: d.approver_id, decision: d.decision })),
    userId, perms.roleName,
  ))
  const canCancel = !!approval && (
    (approval.status === 'pending' && (approval.requested_by === userId || perms.isAdmin)) ||
    (approval.status === 'approved' && perms.isAdmin)
  )
  // 申請可能：承認対象で、承認待ち/承認済みの申請が無い（差戻し・取消後は再申請可）
  const canRequest = !!route && (!approval || approval.status === 'rejected' || approval.status === 'cancelled')

  const badge = approval ? STATUS_BADGE[approval.status] : null
  const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-700 inline-flex items-center gap-1.5">
          {approval?.status === 'approved'
            ? <ShieldCheck className="w-4 h-4 text-green-600" strokeWidth={2.25} aria-hidden />
            : approval?.status === 'pending'
            ? <ShieldAlert className="w-4 h-4 text-amber-500" strokeWidth={2.25} aria-hidden />
            : <ShieldQuestion className="w-4 h-4 text-zinc-400" strokeWidth={2.25} aria-hidden />}
          承認
        </h2>
        {badge
          ? <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
              {badge.label}{pending && snapshotRoute.length > 1 && `（${currentStep}/${snapshotRoute.length} 段階目）`}
            </span>
          : <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500">未申請</span>}
        {pending && (
          <span className="text-xs text-zinc-400">承認待ちの間、このレコードは編集できません</span>
        )}
      </div>

      {/* 承認ルート（申請済みはスナップショット、未申請は現在の設定から） */}
      {(snapshotRoute.length > 0 || (canRequest && route)) && (
        <ol className="mb-3 space-y-1">
          {(snapshotRoute.length > 0 ? snapshotRoute : route!).map((s, i) => {
            const stepNo = i + 1
            const done = approval ? (approval.status === 'approved' || stepNo < currentStep) : false
            const active = pending && stepNo === currentStep
            return (
              <li key={i} className={`flex items-center gap-2 text-xs ${active ? 'text-amber-700 font-medium' : done ? 'text-green-700' : 'text-zinc-500'}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${done ? 'border-green-300 bg-green-50' : active ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-zinc-50'}`}>
                  {done ? '✓' : stepNo}
                </span>
                {s.approvers.map((a) => approverEntryLabel(a, userLabels)).join(s.mode === 'all' ? ' と ' : ' または ')}
                {s.approvers.length > 1 && <span className="text-zinc-400">（{s.mode === 'all' ? '全員' : 'いずれか'}）</span>}
              </li>
            )
          })}
        </ol>
      )}

      {/* 履歴（申請＋各判定） */}
      {approval && (
        <ul className="mb-3 space-y-1 border-l-2 border-zinc-100 pl-3">
          <li className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">{userLabels[approval.requested_by] ?? '申請者'}</span> が申請
            <span className="ml-1 text-zinc-400">{fmt(approval.requested_at)}</span>
            {approval.comment && <span className="ml-1 text-zinc-600">「{approval.comment}」</span>}
          </li>
          {decisions.map((d) => (
            <li key={d.id} className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{userLabels[d.approver_id] ?? '承認者'}</span> が
              {d.decision === 'approved' ? <span className="text-green-700">承認</span> : <span className="text-red-600">差戻し</span>}
              <span className="ml-1 text-zinc-400">step{d.step} · {fmt(d.decided_at)}</span>
              {d.comment && <span className="ml-1 text-zinc-600">「{d.comment}」</span>}
            </li>
          ))}
        </ul>
      )}

      {/* 操作 */}
      <div className="flex flex-wrap items-end gap-2">
        {canRequest && (
          <form action={requestApproval.bind(null, objectType, objectId)} className="flex flex-wrap items-end gap-2">
            <input
              type="text" name="comment" placeholder="申請コメント（任意）"
              className="w-56 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
            <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              {approval ? '再申請' : '承認を申請'}
            </button>
          </form>
        )}
        {canDecide && approval && (
          <form className="flex flex-wrap items-end gap-2">
            <input
              type="text" name="comment" placeholder="コメント（任意）"
              className="w-56 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
            <button formAction={decideApproval.bind(null, approval.id, 'approved')} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
              承認
            </button>
            <button formAction={decideApproval.bind(null, approval.id, 'rejected')} className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100">
              差戻し
            </button>
          </form>
        )}
        {canCancel && approval && (
          <form action={cancelApproval.bind(null, approval.id)}>
            <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
              <Undo2 className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />
              {approval.status === 'approved' ? '承認を取消（管理者）' : '申請を取消'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
