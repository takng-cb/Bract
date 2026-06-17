/**
 * 外部共有パネル（REQ-0084・Phase2 最小版）。管理者のみ表示。
 * 共有先（外部ユーザー）への付与/取消だけを行う。関連子の選択・期限・監査は Phase3。
 * 対応オブジェクト（単数 api）: account / contact / opportunity / project。
 */
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { listGranteesForRecord, GRANTABLE_OBJECTS } from '@/lib/recordGrants'
import { grantRecordToExternal, revokeRecordGrant } from '@/app/actions/recordGrants'
import { Share2, X } from 'lucide-react'

export default async function ExternalSharePanel({
  objectApi, recordId, revalidatePath,
}: {
  objectApi: string
  recordId: string
  revalidatePath: string
}) {
  if (!(GRANTABLE_OBJECTS as readonly string[]).includes(objectApi)) return null
  if (!(await isAdmin())) return null

  const [externals, grantees] = await Promise.all([
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.is_external, true)),
    listGranteesForRecord(objectApi, recordId),
  ])
  const emailById = new Map(externals.map((u) => [u.id, u.email]))
  const grantedIds = new Set(grantees.map((g) => g.grantee_id))
  const available = externals.filter((u) => !grantedIds.has(u.id))

  async function share(formData: FormData) {
    'use server'
    const granteeId = formData.get('granteeId') as string
    if (granteeId) await grantRecordToExternal(objectApi, recordId, granteeId, revalidatePath)
  }
  async function revoke(formData: FormData) {
    'use server'
    const granteeId = formData.get('granteeId') as string
    if (granteeId) await revokeRecordGrant(objectApi, recordId, granteeId, revalidatePath)
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-zinc-700">
        <Share2 className="h-4 w-4 text-brand-600" strokeWidth={2} aria-hidden /> 外部共有
      </h2>
      <p className="mb-3 text-xs text-zinc-400">外部ユーザーにこのレコードを閲覧専用で共有します（共有ポータルに表示）。</p>

      {/* 現在の共有先 */}
      {grantees.length > 0 ? (
        <ul className="mb-3 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
          {grantees.map((g) => (
            <li key={g.grantee_id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-sm text-zinc-700">{emailById.get(g.grantee_id) ?? g.grantee_id}</span>
              <form action={revoke}>
                <input type="hidden" name="granteeId" value={g.grantee_id} />
                <button type="submit" className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700">
                  <X className="h-3.5 w-3.5" aria-hidden /> 取消
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-zinc-400">まだ誰にも共有していません。</p>
      )}

      {/* 共有先の追加 */}
      {externals.length === 0 ? (
        <p className="text-xs text-zinc-400">外部ユーザーが未登録です。「システム設定 → ユーザー管理」で外部ユーザーを追加してください。</p>
      ) : available.length === 0 ? (
        <p className="text-xs text-zinc-400">すべての外部ユーザーに共有済みです。</p>
      ) : (
        <form action={share} className="flex items-center gap-2">
          <select name="granteeId" className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" defaultValue="">
            <option value="" disabled>共有先の外部ユーザーを選択…</option>
            {available.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <button type="submit" className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">共有</button>
        </form>
      )}
    </section>
  )
}
