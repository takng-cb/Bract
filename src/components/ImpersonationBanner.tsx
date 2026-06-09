'use client'

import { useTransition } from 'react'
import { stopImpersonation } from '@/app/actions/userManagement'
import { NavIcon } from '@/lib/navIcon'

type Props = {
  adminEmail:  string
  targetEmail: string
}

export default function ImpersonationBanner({ adminEmail, targetEmail }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleStop() {
    startTransition(async () => {
      await stopImpersonation()
    })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-4 shadow-lg text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <NavIcon icon="🔀" className="w-4 h-4 shrink-0" />
        <span className="truncate">
          <span className="font-semibold">{targetEmail}</span> としてログイン中
          <span className="opacity-75 ml-2 hidden sm:inline">（管理者: {adminEmail}）</span>
        </span>
      </div>
      <button
        onClick={handleStop}
        disabled={isPending}
        className="shrink-0 bg-white text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-amber-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? '復元中...' : '管理者に戻る'}
      </button>
    </div>
  )
}
