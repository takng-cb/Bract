import type { ReactNode } from 'react'
import { NavIcon } from '@/lib/navIcon'

/**
 * ページ共通の見出しブロック（管理・設定系で統一）。
 *
 * - icon: 絵文字キー（NavIcon で Lucide に解決）。ブランドグリーンで描画。
 * - title / description: 見出しと補足。
 * - actions: 右側に置くボタン等（任意）。
 */
export default function PageHeader({
  icon,
  title,
  description,
  actions,
  className = '',
}: {
  icon?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  // タイトルは truncate せず折り返す（モバイルで「…」になり読めない問題の対策）。
  // アクションは幅が足りなければ flex-wrap でタイトルの下の行へ回り込む。
  return (
    <div className={`mb-6 flex items-start justify-between gap-x-4 gap-y-2 flex-wrap ${className}`}>
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="flex items-start gap-2 text-xl sm:text-2xl font-bold text-zinc-900">
          {icon && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <NavIcon icon={icon} className="h-5 w-5" />
            </span>
          )}
          <span className="min-w-0 wrap-break-word">{title}</span>
        </h1>
        {description && <p className="mt-1.5 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="shrink-0 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
