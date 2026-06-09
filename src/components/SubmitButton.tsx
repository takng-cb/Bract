'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

/**
 * フォーム送信ボタン（多重送信防止）。
 * useFormStatus で送信中は自動 disabled + スピナー表示。
 * Server Action フォームの直下に置くこと（form の pending を購読するため）。
 */
export default function SubmitButton({
  children = '保存',
  pendingLabel = '保存中…',
  className = 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5',
}: {
  children?: React.ReactNode
  pendingLabel?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </button>
  )
}
