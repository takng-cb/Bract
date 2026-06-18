/**
 * 外部共有パネル（REQ-0084・Phase2/3）。管理者のみ表示。
 * 共有先（外部ユーザー）への付与/取消＋有効期限＋監査ログ＋関連子の選択（共有グラフ）。
 * 対応オブジェクト（単数 api）: account / contact / opportunity / project。
 */
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { listGranteesForRecord, GRANTABLE_OBJECTS } from '@/lib/recordGrants'
import { getRecordLinks } from '@/lib/recordLinks'
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

  const [externals, grantees, links] = await Promise.all([
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.is_external, true)),
    listGranteesForRecord(objectApi, recordId),
    getRecordLinks({ object_api: objectApi, record_id: recordId }),
  ])
  const emailById = new Map(externals.map((u) => [u.id, u.email]))
  const grantedIds = new Set(grantees.map((g) => g.grantee_id))
  const available = externals.filter((u) => !grantedIds.has(u.id))
  // 共有グラフ: 共有可能な型（GRANTABLE）の関連レコードを「含める子」候補にする
  const relatedChildren = links.filter((r) => (GRANTABLE_OBJECTS as readonly string[]).includes(r.object_api))

  async function share(formData: FormData) {
    'use server'
    const granteeId = formData.get('granteeId') as string
    if (!granteeId) return
    const days = Number(formData.get('expiresInDays') ?? 0) || 0
    // 親レコードを付与
    await grantRecordToExternal(objectApi, recordId, granteeId, revalidatePath, days)
    // 選択された関連子を付与（子ごとに grant を実体化＝ADR-0029）
    const children = formData.getAll('children') as string[]
    for (const c of children) {
      const sep = c.indexOf(':')
      const api = c.slice(0, sep), rid = c.slice(sep + 1)
      if (api && rid && (GRANTABLE_OBJECTS as readonly string[]).includes(api)) {
        await grantRecordToExternal(api, rid, granteeId, revalidatePath, days)
      }
    }
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
              <span className="min-w-0 truncate text-sm text-zinc-700">
                {emailById.get(g.grantee_id) ?? g.grantee_id}
                <span className="ml-2 text-[11px] text-zinc-400">{g.expires_at ? `期限 ${new Date(g.expires_at).toISOString().slice(0, 10)}` : '無期限'}</span>
              </span>
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
        <form action={share} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select name="granteeId" className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" defaultValue="">
              <option value="" disabled>共有先の外部ユーザーを選択…</option>
              {available.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            <select name="expiresInDays" className="shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" defaultValue="0" title="有効期限">
              <option value="0">無期限</option>
              <option value="7">7日</option>
              <option value="30">30日</option>
              <option value="90">90日</option>
            </select>
            <button type="submit" className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">共有</button>
          </div>
          {/* 関連子の選択（共有グラフ）: チェックした関連レコードも同時に共有する */}
          {relatedChildren.length > 0 && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2">
              <p className="mb-1 text-[11px] text-zinc-500">同時に共有する関連レコード（任意）:</p>
              <div className="flex flex-col gap-1">
                {relatedChildren.map((r) => (
                  <label key={`${r.object_api}:${r.record_id}`} className="flex items-center gap-1.5 text-[12.5px] text-zinc-700">
                    <input type="checkbox" name="children" value={`${r.object_api}:${r.record_id}`} className="accent-brand-600" />
                    <span aria-hidden>{r.icon}</span><span className="truncate">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  )
}
