import { db } from '@/lib/db'
import { users, roles } from '@/lib/schema'
import { requireAdmin, getSupabaseUser } from '@/lib/auth'
import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import DeleteUserButton from './DeleteUserButton'
import ResetPasswordButton from './ResetPasswordButton'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

const ROLE_LABELS: Record<string, string> = {
  admin:  '管理者',
  editor: '編集者',
  viewer: '閲覧者',
}
const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-red-100 text-red-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-zinc-100 text-zinc-600',
}

export default async function AdminUsersPage() {
  await requireAdmin()

  const [allUsers, roleRows, me] = await Promise.all([
    db.select().from(users).orderBy(asc(users.created_at)),
    db.select({ id: roles.id, name: roles.name, is_system: roles.is_system }).from(roles),
    getSupabaseUser(),
  ])

  // permissions.ts と同じ解決順（role_id 優先 → role テキスト）で「実効ロール」を表示する。
  // ロールの割り当て・変更は /admin/roles に一本化（#144）。ここは読み取り専用。
  const rolesById = new Map(roleRows.map((r) => [r.id, r]))
  const effectiveRole = (u: { role: string; role_id: string | null }) => {
    const byId = u.role_id ? rolesById.get(u.role_id) : null
    if (byId) return { name: byId.name, isSystem: byId.is_system }
    return { name: u.role, isSystem: true } // text role は admin/editor/viewer（標準）
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader icon="👥" title="ユーザー管理" description="ログインユーザーのパスワード・削除を管理します（ロールの割り当ては「ロール管理」）" />

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2.5 text-sm text-zinc-600">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} aria-hidden />
        <span>ロールの割り当て・変更は</span>
        <Link href="/admin/roles" className="font-semibold text-brand-700 underline hover:text-brand-800">ロール管理</Link>
        <span>に一本化されています。</span>
      </div>

      <Card padded={false}>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">メールアドレス</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">ロール</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">パスワード</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">削除</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {allUsers.map((u) => {
              const eff = effectiveRole(u)
              return (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${eff.isSystem ? (ROLE_COLORS[eff.name] ?? 'bg-zinc-100 text-zinc-600') : 'bg-violet-100 text-violet-700'}`}>
                      {eff.isSystem ? (ROLE_LABELS[eff.name] ?? eff.name) : eff.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ResetPasswordButton
                      userId={u.id}
                      email={u.email}
                      isSelf={u.id === me?.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <DeleteUserButton
                      userId={u.id}
                      email={u.email}
                      isSelf={u.id === me?.id}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {allUsers.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-8">ユーザーがいません</p>
        )}
      </Card>

      <div className="mt-6 bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
        <p><span className="font-semibold text-zinc-700">ロール</span>：実効ロール（role_id 優先で解決）を表示。割り当て・変更は<Link href="/admin/roles" className="underline">ロール管理</Link>で行います。</p>
        <p><span className="font-semibold text-zinc-700">パスワード</span>：管理者権限で強制上書き。新パスワードは安全な手段で対象ユーザーに伝達してください。自分のパスワードは「設定」ページから変更します。</p>
        <p><span className="font-semibold text-red-600">削除</span>：Supabase Auth と CRM の両方から完全削除します。自分自身は削除できません。</p>
      </div>
    </div>
  )
}
