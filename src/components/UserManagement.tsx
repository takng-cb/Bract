'use client'

import { useState, useTransition, useActionState } from 'react'
import Link from 'next/link'
import { createUser, startImpersonation } from '@/app/actions/userManagement'
import { NavIcon } from '@/lib/navIcon'

type RoleTone = 'admin' | 'editor' | 'viewer' | 'custom'
type User = {
  id:         string
  email:      string
  /** 実効ロールの表示名（role_id 優先で解決。カスタムロール名を含む） */
  roleLabel:  string
  /** バッジ配色用のトーン */
  roleTone:   RoleTone
  created_at: Date | null
}

const ROLE_TONE_CLASS: Record<RoleTone, string> = {
  admin:  'bg-red-100 text-red-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-zinc-100 text-zinc-600',
  custom: 'bg-violet-100 text-violet-700',
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
        // 追加したユーザーをローカルリストに反映（新規は常に閲覧者。ロールは /admin/roles で割当）
        const email = fd.get('email') as string
        setLocalUsers((prev) => [...prev, { id: crypto.randomUUID(), email, roleLabel: '閲覧者', roleTone: 'viewer', created_at: new Date() }])
        setShowForm(false)
      }
      return err
    },
    null,
  )
  const [isPending, startTransition] = useTransition()

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
        <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="👥" className="w-4 h-4" /> ユーザー管理</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ ユーザー追加
        </button>
      </div>
      <p className="text-xs text-zinc-400">
        ロールの割り当て・変更は <Link href="/admin/roles" className="font-medium text-brand-700 underline hover:text-brand-800">ロール管理</Link> で行います（ここでは表示のみ）。
      </p>

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
          <p className="text-xs text-zinc-400">
            社内ユーザーは<span className="font-medium text-zinc-600">閲覧者</span>で作成されます。ロールの割り当ては作成後に
            <Link href="/admin/roles" className="font-medium text-brand-700 underline hover:text-brand-800">ロール管理</Link>で行ってください。
          </p>
          <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
            <input type="checkbox" name="is_external" className="mt-0.5 accent-brand-600" />
            <span>
              <span className="font-medium text-zinc-700">外部ユーザーとして作成</span>
              <span className="block text-xs text-zinc-400">社内 CRM は閲覧不可。共有された特定レコードのみ「共有ポータル」で閲覧できます（REQ-0084）。</span>
            </span>
          </label>
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
                {/* ロールは読み取り表示（割り当て・変更は /admin/roles に一本化。#144）。
                    role_id から解決した実効ロール名（カスタムロール名を含む）を表示する。 */}
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_TONE_CLASS[u.roleTone]}`}>
                  {u.roleLabel}{u.id === currentUserId ? '（自分）' : ''}
                </span>

                {/* なりすましボタン（自分以外） */}
                {u.id !== currentUserId && (
                  <button
                    onClick={() => handleImpersonate(u.id, u.email)}
                    disabled={isPending || impersonating === u.id}
                    className="text-xs px-2 py-1 border border-zinc-300 rounded-md text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                    title={`${u.email} としてログイン`}
                  >
                    {impersonating === u.id ? '遷移中...' : <span className="inline-flex items-center gap-1"><NavIcon icon="🔀" className="w-3.5 h-3.5" /> なりすまし</span>}
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
