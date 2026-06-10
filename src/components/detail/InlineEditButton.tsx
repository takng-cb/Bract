'use client'

import { SquarePen } from 'lucide-react'

/**
 * 詳細ページ右上の「編集」ボタン。クリックでイベントを発火し、
 * 同じイベントを購読している EditableInfoCard がインライン編集モードに入る。
 * （/edit ページへは遷移しない）
 */
export default function InlineEditButton({
  event = 'bract:edit-record',
  label = '編集',
}: {
  event?: string
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(event))}
      className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
    >
      <SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> {label}
    </button>
  )
}
