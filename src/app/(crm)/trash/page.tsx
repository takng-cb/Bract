/**
 * /trash — レコードのゴミ箱（REQ-0047）
 *
 * - 削除されたレコードの一覧。管理者は全件、一般ユーザーは自分が削除したもののみ。
 * - 「復元」で元のブックに戻す（id 重複時はエラー）。「完全削除」で即時に消す。
 * - 保持期限（既定30日）を過ぎたものは自動的に消える。
 */
export const dynamic = 'force-dynamic'

import { Trash2, Undo2 } from 'lucide-react'
import { listTrash } from '@/lib/trash'
import { restoreTrashRecord, purgeTrashRecord } from '@/app/actions/trash'
import { getUserLabels } from '@/lib/approvals'
import PageHeader from '@/components/ui/PageHeader'
import DeleteButton from '@/components/DeleteButton'
import { getAppTimeZone } from '@/lib/systemSettings'
import { fmtDateTime } from '@/lib/datetime'

export default async function TrashPage() {
  const { rows, isAdmin, retention } = await listTrash()
  const userLabels = await getUserLabels(rows.map((r) => r.deleted_by ?? '').filter(Boolean))
  const tz = await getAppTimeZone()

  const fmt = (d: Date | null) => fmtDateTime(d, tz)

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        icon="🗑️"
        title="ゴミ箱"
        description={`削除したレコードを${retention}日間保管します（期限を過ぎると自動的に完全削除）。${isAdmin ? '管理者のため全ユーザーの削除分を表示しています。' : '自分が削除したレコードのみ表示されます。'}`}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white py-20 text-center text-zinc-400">
          <Trash2 className="mx-auto mb-3 h-10 w-10 text-zinc-300" strokeWidth={1.75} aria-hidden />
          <p className="text-lg font-medium">ゴミ箱は空です</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">レコード</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">ブック</th>
                {isAdmin && <th className="px-3 py-2 text-left font-medium text-zinc-600">削除者</th>}
                <th className="px-3 py-2 text-left font-medium text-zinc-600">削除日時</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-medium text-zinc-900">{r.label}</td>
                  <td className="px-3 py-2 text-zinc-600">{r.object_label}</td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-zinc-500 text-xs">
                      {r.deleted_by ? (userLabels[r.deleted_by] ?? '—') : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500 text-xs">{fmt(r.deleted_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <form action={restoreTrashRecord.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          <Undo2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />復元
                        </button>
                      </form>
                      <DeleteButton
                        action={purgeTrashRecord.bind(null, r.id)}
                        confirmMessage={`「${r.label}」をゴミ箱から完全に削除しますか？（復元できなくなります）`}
                        label="完全削除"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        ※ 復元されるのはレコード本体のみです。明細・関連付けなどの子データは復元されません。
      </p>
    </div>
  )
}
