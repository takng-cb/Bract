import type { ReactNode } from 'react'

/**
 * 共通の白パネル（管理・設定系で統一）。
 * 既定で内側余白 p-6。テーブル等で余白を消したい場合は padded={false}。
 */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white shadow-xs ${padded ? 'p-6' : 'overflow-hidden'} ${className}`}
    >
      {children}
    </div>
  )
}

/** カード内の小見出し（任意で使う）。 */
export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`mb-4 text-sm font-bold text-zinc-700 ${className}`}>{children}</h2>
}
