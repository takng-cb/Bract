'use client'

import { useActionState } from 'react'
import { updatePassword } from '@/app/actions/auth'
import Image from 'next/image'
import Link from 'next/link'
import { NavIcon } from '@/lib/navIcon'

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, null)

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Image src="/icon.png" alt="Bract" width={32} height={32} unoptimized />
              <span className="text-2xl font-bold text-zinc-900">Bract CRM</span>
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm text-center space-y-4">
            <div className="flex justify-center"><NavIcon icon="✅" className="w-10 h-10 text-green-600" /></div>
            <h2 className="text-lg font-semibold text-zinc-900">パスワードを更新しました</h2>
            <p className="text-sm text-zinc-500">
              新しいパスワードでログインできます。
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ログイン画面へ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/icon.png" alt="Bract" width={32} height={32} unoptimized />
            <span className="text-2xl font-bold text-zinc-900">Bract CRM</span>
          </div>
          <p className="text-sm text-zinc-500">新しいパスワードを設定</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm">
          <form action={formAction} className="space-y-4">
            {state && state !== 'success' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
                {state}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                name="password"
                required
                autoComplete="new-password"
                autoFocus
                minLength={8}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-400 mt-1">8文字以上で設定してください</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                パスワード（確認）
              </label>
              <input
                type="password"
                name="confirm"
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? '更新中...' : 'パスワードを更新'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
