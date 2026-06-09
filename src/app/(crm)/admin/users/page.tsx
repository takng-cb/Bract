import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { requireAdmin, getSupabaseUser } from '@/lib/auth'
import { updateUserRole } from '@/app/actions/admin'
import { asc } from 'drizzle-orm'
import RoleSelect from './RoleSelect'
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

  const [allUsers, me] = await Promise.all([
    db.select().from(users).orderBy(asc(users.created_at)),
    getSupabaseUser(),
  ])

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader icon="👥" title="ユーザー管理" description="ログインユーザーの権限を設定します" />

      <Card padded={false}>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">メールアドレス</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">現在の権限</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">変更</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">パスワード</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">削除</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {allUsers.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-800">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] ?? ''}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    updateAction={updateUserRole}
                  />
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
            ))}
          </tbody>
        </table>
        {allUsers.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-8">ユーザーがいません</p>
        )}
      </Card>

      <div className="mt-6 bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
        <p><span className="font-semibold text-red-600">管理者</span>：全操作 ＋ ユーザー管理</p>
        <p><span className="font-semibold text-blue-600">編集者</span>：データの登録・編集・削除</p>
        <p><span className="font-semibold text-zinc-600">閲覧者</span>：データの閲覧のみ</p>
        <p className="pt-2 border-t border-zinc-200 mt-2"><span className="font-semibold text-zinc-700">パスワード</span>：管理者権限で強制上書き。新パスワードは安全な手段で対象ユーザーに伝達してください。自分のパスワードは「設定」ページから変更します。</p>
        <p><span className="font-semibold text-red-600">削除</span>：Supabase Auth と CRM の両方から完全削除します。自分自身は削除できません。</p>
      </div>
    </div>
  )
}
