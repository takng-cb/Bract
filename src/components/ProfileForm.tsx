'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/settings'
import { useActionToast } from '@/components/Toast'

type Props = {
  currentDisplayName: string | null
  email: string
}

export default function ProfileForm({ currentDisplayName, email }: Props) {
  const [state, formAction, pending] = useActionState(updateProfile, null)
  // 保存結果はトーストで通知（REQ-0057。成功の inline 表示は廃止、エラーは残す）
  useActionToast(pending, state, { success: 'プロフィールを保存しました' })

  const errorMsg = state?.startsWith('error:') ? state.slice(6) : null

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <h2 className="text-sm font-bold text-zinc-700 mb-5">プロフィール</h2>

      <form action={formAction} className="space-y-4">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">メールアドレス</label>
          <p className="text-sm text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">{email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">表示名</label>
          <input
            type="text"
            name="display_name"
            defaultValue={currentDisplayName ?? ''}
            placeholder="サイドバーに表示される名前"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-400 mt-1">未設定の場合はメールアドレスが表示されます</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {pending ? '保存中...' : '保存'}
        </button>
      </form>
    </div>
  )
}
