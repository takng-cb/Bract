'use client'

import { useActionState } from 'react'
import { updatePassword } from '@/app/actions/settings'

type Props = {
  passwordMinLength?: number
}

export default function PasswordForm({ passwordMinLength = 8 }: Props) {
  const [state, formAction, pending] = useActionState(updatePassword, null)

  const isSuccess = state === 'success'
  const errorMsg  = state?.startsWith('error:') ? state.slice(6) : null

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-5">パスワード変更</h2>

      <form action={formAction} className="space-y-4">
        {isSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-md">
            ✅ パスワードを更新しました
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">新しいパスワード</label>
          <input
            type="password"
            name="password"
            required
            minLength={passwordMinLength}
            autoComplete="new-password"
            placeholder={`${passwordMinLength}文字以上`}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">パスワード（確認）</label>
          <input
            type="password"
            name="confirm"
            required
            minLength={passwordMinLength}
            autoComplete="new-password"
            placeholder="もう一度入力してください"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? '更新中...' : 'パスワードを変更'}
        </button>
      </form>
    </div>
  )
}
