import Link from 'next/link'
import { type ReactNode } from 'react'

export type Crumb = {
  label: string
  href?: string   // 省略すると現在ページ（非リンク）として扱う
}

type Props = {
  crumbs:   Crumb[]
  actions?: ReactNode
}

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

/**
 * 詳細ページ共通のナビゲーションバー。
 * パンくず（← 一覧 / レコード名）と編集・削除ボタンを一列に並べる。
 */
export default function RecordHeader({ crumbs, actions }: Props) {
  const [first, ...rest] = crumbs

  return (
    <div className="flex items-center gap-1.5 mb-5 min-w-0">

      {/* 先頭クラム：← アイコン付きで一覧ページへ戻る */}
      {first?.href ? (
        <Link
          href={first.href}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 transition-colors shrink-0"
        >
          <ChevronLeft />
          {first.label}
        </Link>
      ) : (
        <span className="text-sm text-zinc-500 shrink-0">{first?.label}</span>
      )}

      {/* 以降のクラム */}
      {rest.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-300 text-sm select-none">/</span>
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors truncate"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-sm text-zinc-700 font-medium truncate">{crumb.label}</span>
          )}
        </span>
      ))}

      {/* アクションボタン（編集・削除など） */}
      {actions && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        </>
      )}
    </div>
  )
}
