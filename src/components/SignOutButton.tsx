'use client'

import { signOut } from '@/app/actions/auth'
import { NavIcon } from '@/lib/navIcon'

type Props = { collapsed?: boolean }

export default function SignOutButton({ collapsed = false }: Props) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        title={collapsed ? 'ログアウト' : undefined}
        className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-white w-full ${
          collapsed ? 'justify-center' : 'text-left'
        }`}
      >
        <NavIcon icon="🚪" className="w-4 h-4 shrink-0" />
        {!collapsed && <span>ログアウト</span>}
      </button>
    </form>
  )
}
