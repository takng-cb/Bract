'use client'

import { signOut } from '@/app/actions/auth'

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-white w-full text-left"
      >
        <span>🚪</span>
        <span>ログアウト</span>
      </button>
    </form>
  )
}
