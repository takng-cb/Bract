'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setModuleEnabled } from '@/app/actions/modules'

/**
 * モジュール ON/OFF トグル（#11）。
 * locked（ALWAYS_ON / entitled外）はスイッチ無効＋理由表示。
 */
export default function ModuleToggle({
  moduleId, on, locked, lockedReason,
}: {
  moduleId: string
  on: boolean
  locked?: boolean
  lockedReason?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState(on)

  const toggle = () => {
    if (locked || pending) return
    const next = !optimistic
    setOptimistic(next)
    setErr(null)
    start(async () => {
      const res = await setModuleEnabled(moduleId, next)
      if (!res.ok) { setOptimistic(!next); setErr(res.error) }
      else router.refresh()
    })
  }

  if (locked) {
    return (
      <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-500" title={lockedReason}>
        {lockedReason ?? '固定'}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={`${moduleId} を${optimistic ? '無効化' : '有効化'}`}
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          optimistic ? 'bg-green-500' : 'bg-zinc-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${optimistic ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      {err && <span className="text-[10px] text-rose-600 max-w-[140px] text-right">{err}</span>}
    </div>
  )
}
