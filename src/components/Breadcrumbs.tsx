/**
 * 編集・新規作成ページの上部に置く 1 行パンくず。
 *
 * 例: 活動履歴 / 契約書案送付 / 編集
 *
 * - 横スクロールせず、1 行に収める（`whitespace-nowrap`）
 * - 中間の長いタイトル（リンク）はコンテナ幅に応じて省略 (...) する
 *   - `truncate` を使うため、リンク要素に `min-w-0` を当てて flex の縮みを許可
 * - リーフ（末尾の固定文字列、例: "編集"）と区切り `/` は縮まない
 */
import Link from 'next/link'
import { Fragment } from 'react'

export type Crumb = {
  label: string
  /** リンク先。指定なしのときはテキストのみ（リーフ用） */
  href?: string
}

type Props = {
  items: Crumb[]
}

export default function Breadcrumbs({ items }: Props) {
  if (items.length === 0) return null
  return (
    <div className="text-sm text-zinc-400 mb-4 flex items-center gap-1.5 min-w-0 whitespace-nowrap overflow-hidden">
      {items.map((c, i) => {
        const isLast = i === items.length - 1
        const node = c.href && !isLast
          ? <Link href={c.href} className="hover:text-zinc-600 truncate min-w-0">{c.label}</Link>
          : <span className={`${isLast ? 'text-zinc-700' : ''} truncate min-w-0`}>{c.label}</span>
        return (
          <Fragment key={i}>
            {i > 0 && <span className="shrink-0">/</span>}
            {node}
          </Fragment>
        )
      })}
    </div>
  )
}
