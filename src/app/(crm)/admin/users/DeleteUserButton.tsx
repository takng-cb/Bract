'use client'

import { deleteUser } from '@/app/actions/admin'

type Props = {
  userId: string
  email: string
  isSelf: boolean
}

/**
 * ユーザー削除ボタン。
 * 自分自身 (isSelf) には削除ボタンを出さず disabled の説明テキストにする。
 * 削除は二重 confirm: メールアドレスを含む確認 + 「本当に削除しますか？」
 */
export default function DeleteUserButton({ userId, email, isSelf }: Props) {
  if (isSelf) {
    return (
      <span className="text-xs text-zinc-400">（自分自身）</span>
    )
  }

  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        const confirmed = confirm(
          `「${email}」を完全に削除します。\n\n` +
            `この操作は取り消せません。Supabase Auth と CRM の両方から削除されます。\n\n` +
            `本当に削除しますか？`,
        )
        if (!confirmed) e.preventDefault()
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="px-3 py-1 border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50 transition-colors"
      >
        削除
      </button>
    </form>
  )
}
