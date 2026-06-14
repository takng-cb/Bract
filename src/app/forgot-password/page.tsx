'use client'

import { useActionState } from 'react'
import { requestPasswordReset } from '@/app/actions/auth'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null)

  if (state === 'sent') {
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
            <div className="flex justify-center"><NavIcon icon="✉️" className="w-10 h-10 text-blue-500" /></div>
            <h2 className="text-lg font-semibold text-zinc-900">メールを送信しました</h2>
            <p className="text-sm text-zinc-500">
              入力したメールアドレスにパスワードリセット用のリンクを送信しました。
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 text-sm text-blue-600 hover:underline"
            >
              <span className="inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" strokeWidth={2.25} aria-hidden />ログイン画面に戻る</span>
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
          <p className="text-sm text-zinc-500">パスワードをリセット</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm space-y-4">
          <p className="text-sm text-zinc-600">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクを送信します。
          </p>

          <form action={formAction} className="space-y-4">
            {state && state !== 'sent' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
                {state}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? '送信中...' : 'リセットメールを送信'}
            </button>
          </form>

          <div className="text-center">
            <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-700">
              <span className="inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" strokeWidth={2.25} aria-hidden />ログイン画面に戻る</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
