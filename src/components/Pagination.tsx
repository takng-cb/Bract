import Link from 'next/link'

type Props = {
  currentPage:  number
  totalPages:   number
  basePath:     string
  filterParams: string[]                    // 'f' クエリパラメータを引き継ぐ
  extraParams?: Record<string, string>      // 日付レンジ等その他のパラメータ
}

function buildHref(basePath: string, filterParams: string[], page: number, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams()
  if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v))
  filterParams.forEach((f) => params.append('f', f))
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default function Pagination({ currentPage, totalPages, basePath, filterParams }: Props) {
  if (totalPages <= 1) return null

  // 表示するページ番号を生成（省略あり）
  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  const linkClass = 'px-3 py-1.5 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors'
  const activeClass = 'px-3 py-1.5 text-sm border border-blue-600 rounded-md bg-blue-600 text-white font-medium'
  const disabledClass = 'px-3 py-1.5 text-sm border border-zinc-100 rounded-md text-zinc-300 cursor-not-allowed'

  return (
    <div className="flex items-center justify-center gap-1 mt-4 pb-2">
      {currentPage > 1
        ? <Link href={buildHref(basePath, filterParams, currentPage - 1)} className={linkClass}>← 前へ</Link>
        : <span className={disabledClass}>← 前へ</span>
      }

      {pages.map((p, i) =>
        p === '…'
          ? <span key={`ellipsis-${i}`} className="px-2 text-zinc-400 text-sm">…</span>
          : <Link
              key={p}
              href={buildHref(basePath, filterParams, p)}
              className={p === currentPage ? activeClass : linkClass}
            >
              {p}
            </Link>
      )}

      {currentPage < totalPages
        ? <Link href={buildHref(basePath, filterParams, currentPage + 1)} className={linkClass}>次へ →</Link>
        : <span className={disabledClass}>次へ →</span>
      }
    </div>
  )
}
