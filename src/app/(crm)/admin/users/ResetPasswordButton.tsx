'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { resetUserPassword } from '@/app/actions/admin'

type Props = {
  userId: string
  email: string
  isSelf: boolean
}

/**
 * 管理者が他ユーザーのパスワードを強制上書きするための modal トリガー。
 * 自分自身 (isSelf) の場合は /settings に誘導する hint を表示。
 *
 * action 戻り値: 'success' = 成功、それ以外の文字列 = エラーメッセージ。
 * useActionState 初期値は null で「未 submit」を表す。
 */
export default function ResetPasswordButton({ userId, email, isSelf }: Props) {
  const [open, setOpen] = useState(false)
  const [result, action, pending] = useActionState(resetUserPassword, null)
  const [justSucceeded, setJustSucceeded] = useState(false)

  // 成功通知 → 2 秒後にモーダル close
  useEffect(() => {
    if (result === 'success' && !pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Server Action 完了後の成功通知
      setJustSucceeded(true)
      const t = setTimeout(() => {
        setOpen(false)
        setJustSucceeded(false)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [result, pending])

  if (isSelf) {
    return (
      <span className="text-xs text-zinc-400" title="自分のパスワードは「設定」ページから変更">
        （自分）
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1 border border-zinc-300 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
      >
        パスワード変更
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-zinc-900 mb-1">
              パスワード変更
            </h2>
            <p className="text-sm text-zinc-500 mb-4 break-all">
              対象: <span className="font-medium">{email}</span>
            </p>

            <form action={action} className="space-y-3">
              <input type="hidden" name="userId" value={userId} />

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  新しいパスワード
                </label>
                <input
                  type="password"
                  name="password"
                  autoFocus
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  ※ 入力したパスワードを、対象ユーザーに安全な手段（口頭・パスワードマネージャ等）で伝達してください
                </p>
              </div>

              {result === 'success' && justSucceeded && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  パスワードを更新しました
                </p>
              )}
              {result && result !== 'success' && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {result}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pending ? '更新中…' : '適用'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
