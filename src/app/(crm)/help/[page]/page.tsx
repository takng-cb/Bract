/**
 * /help/[page] — アプリ内マニュアル（REQ-0056）。
 *
 * public/manual/*.html（スタンドアロン版と同一ソース）の <main> をアプリの
 * レイアウト内に表示する。PWA（インストール版）でも通常のページ遷移になるため
 * 「別ウィンドウで戻れない」問題が起きない。スタンドアロン版 /manual/ も併存
 * （社外共有・印刷用途）。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { HELP_PAGES, isHelpPage, loadHelpContent, type HelpPage } from '@/lib/helpManual'

export const dynamic = 'force-dynamic'

export default async function HelpPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params
  if (!isHelpPage(page)) notFound()
  const content = await loadHelpContent(page)
  if (!content) notFound()

  return (
    <div>
      {/* マニュアル共通スタイル（スタンドアロン版と共用・.bract-manual スコープ） */}
      {/* eslint-disable-next-line @next/next/no-css-tags -- public 配下の静的 CSS をスタンドアロン版と共用するため */}
      <link rel="stylesheet" href="/manual/manual.css" />

      {/* 編タブ（アプリ内ナビ） */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200 px-4 md:px-8 py-2.5 flex items-center gap-x-4 gap-y-1 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-800">
          <BookOpen className="w-4 h-4 text-brand-700" strokeWidth={2.25} aria-hidden />
          操作マニュアル
        </span>
        <nav className="flex items-center gap-x-3 gap-y-1 flex-wrap">
          {(Object.entries(HELP_PAGES) as [HelpPage, string][]).map(([key, label]) => (
            <Link
              key={key}
              href={`/help/${key}`}
              className={`text-[13px] rounded-md px-2 py-1 transition-colors ${
                key === page ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <a
          href={`/manual/${page}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[12px] text-zinc-400 hover:text-zinc-700"
          title="印刷・共有用にブラウザ版を開く"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />ブラウザ版
        </a>
      </div>

      {/* 本文（public/manual の <main> をそのまま表示。自前の静的ファイルなので信頼できる） */}
      <div className="bract-manual">
        <main dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  )
}
