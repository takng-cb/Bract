import Link from 'next/link'
import { type ReactNode } from 'react'

export type Crumb = {
  label: string
  href?: string   // 省略すると現在ページ（非リンク）として扱う
}

/** ヒーロー表示のメタ項目（業種 / 担当 / ID / 登録日 など） */
export type MetaItem = {
  icon?: ReactNode
  label?: string
  value: ReactNode
  mono?: boolean
}

type Props = {
  crumbs:   Crumb[]
  actions?: ReactNode
  /** 指定すると「ヒーロー（アバター＋タイトル＋バッジ＋メタ）」表示になる（REQ-0020 / design_handoff） */
  title?:   ReactNode
  avatar?:  ReactNode
  badges?:  ReactNode
  meta?:    MetaItem[]
}

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

/** パンくず行（先頭は ← 付きで一覧へ戻る） */
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const [first, ...rest] = crumbs
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {first?.href ? (
        <Link href={first.href} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 transition-colors shrink-0">
          <ChevronLeft />{first.label}
        </Link>
      ) : (
        <span className="text-sm text-zinc-500 shrink-0">{first?.label}</span>
      )}
      {rest.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-300 text-sm select-none">/</span>
          {crumb.href ? (
            <Link href={crumb.href} className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors truncate">{crumb.label}</Link>
          ) : (
            <span className="text-sm text-zinc-700 font-medium truncate">{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

/**
 * 詳細ページ共通ヘッダ。
 * - title 未指定：従来どおりパンくず＋アクションを1行で表示（後方互換）。
 * - title 指定：design_handoff「Record Detail」のヒーロー（アバター＋タイトル＋バッジ＋メタ行）。
 */
export default function RecordHeader({ crumbs, actions, title, avatar, badges, meta }: Props) {
  // 後方互換：ヒーロー無し（従来の1行レイアウト）
  if (!title) {
    return (
      <div className="flex items-center gap-1.5 mb-5 min-w-0">
        <Breadcrumb crumbs={crumbs} />
        {actions && (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          </>
        )}
      </div>
    )
  }

  // ヒーロー表示：アクションはタイトル行に置かず、パンくずと同じ最上段（右）に分離する。
  // （タイトルとボタンが同列だとモバイルで詰まって崩れて見えるため）
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Breadcrumb crumbs={crumbs} />
        {actions && <div className="flex items-center flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="flex items-start gap-3 mt-3">
        {avatar && (
          <div className="grid place-items-center w-12 h-12 rounded-lg bg-brand-50 text-brand-700 shrink-0">{avatar}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 wrap-break-word min-w-0">{title}</h1>
            {badges}
          </div>
          {meta && meta.length > 0 && (
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1.5">
              {meta.map((m, i) => (
                <span key={i} className={`inline-flex items-center gap-1 text-xs text-zinc-500 min-w-0 max-w-full ${m.mono ? 'font-mono' : ''}`}>
                  {m.icon}
                  {m.label && <span>{m.label}</span>}
                  <b className="text-zinc-700 font-semibold truncate">{m.value}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
