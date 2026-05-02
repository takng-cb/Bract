'use client'

import { useState, useTransition, useActionState } from 'react'
import { createUser, updateUserRole, startImpersonation } from '@/app/actions/userManagement'

type User = {
  id:         string
  email:      string
  role:       string
  created_at: Date | null
}

type Props = {
  users:       User[]
  currentUserId: string
}

export default function UserManagement({ users, currentUserId }: Props) {
  const [showForm, setShowForm]     = useState(false)
  const [localUsers, setLocalUsers] = useState(users)
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [createError, createAction, createPending] = useActionState(
    async (_: string | null, fd: FormData) => {
      const err = await createUser(_, fd)
      if (!err) {
        // 追加したユーザーをローカルリストに反映（簡易）
        const email = fd.get('email') as string
        const role  = (fd.get('role') as string) === 'admin' ? 'admin' : 'member'
        setLocalUsers((prev) => [...prev, { id: crypto.randomUUID(), email, role, created_at: new Date() }])
        setShowForm(false)
      }
      return err
    },
    null,
  )
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    startTransition(async () => {
      const { error } = await updateUserRole(userId, newRole)
      if (!error) {
        setLocalUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, role: newRole } : u)
        )
      } else {
        alert(error)
      }
    })
  }

  function handleImpersonate(userId: string, email: string) {
    if (!confirm(`「${email}」としてログインします。現在のセッションは保持され、後で管理者に戻れます。\n\n続けますか？`)) return
    setImpersonating(userId)
    startTransition(async () => {
      const result = await startImpersonation(userId)
      if ('error' in result) {
        alert(result.error)
        setImpersonating(null)
      } else {
        // Magic Link へ遷移（セッションが切り替わる）
        window.location.href = result.url
      }
    })
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-800">👥 ユーザー管理</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ ユーザー追加
        </button>
      </div>

      {/* ユーザー追加フォーム */}
      {showForm && (
        <form action={createAction} className="border border-zinc-100 rounded-lg p-4 bg-zinc-50 space-y-3">
          <p className="text-sm font-medium text-zinc-700">新規ユーザー</p>
          {createError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {createError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">メールアドレス</label>
              <input
                type="email" name="email" required
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">初期パスワード</label>
              <input
                type="password" name="password" required minLength={8}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="8文字以上"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">ロール</label>
            <select
              name="role"
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">メンバー</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit" disabled={createPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createPending ? '作成中...' : '作成する'}
            </button>
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* ユーザー一覧 */}
      {localUsers.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-6">ユーザーがいません</p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {localUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{u.email}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  登録: {u.created_at ? new Date(u.created_at).toLocaleDateString('ja-JP') : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* ロール変更（自分以外） */}
                {u.id !== currentUserId ? (
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'member')}
                    disabled={isPending}
                    className="border border-zinc-300 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="member">メンバー</option>
                    <option value="admin">管理者</option>
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {u.role === 'admin' ? '管理者' : 'メンバー'}（自分）
                  </span>
                )}

                {/* なりすましボタン（自分以外） */}
                {u.id !== currentUserId && (
                  <button
                    onClick={() => handleImpersonate(u.id, u.email)}
                    disabled={isPending || impersonating === u.id}
                    className="text-xs px-2 py-1 border border-zinc-300 rounded-md text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                    title={`${u.email} としてログイン`}
                  >
                    {impersonating === u.id ? '遷移中...' : '🔀 なりすまし'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
