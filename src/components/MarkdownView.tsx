'use client'

/**
 * Wiki 本文（Markdown）レンダラ (Issue #78)。
 * `@tailwindcss/typography`（prose）プラグインは未導入のため、
 * 各要素を components prop で明示的に Tailwind スタイルする。
 * XSS 対策として rehypeSanitize を必須適用する。
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { headingSlug } from '@/lib/markdownToc'
import type { ReactNode } from 'react'

/** 見出しの子要素からプレーンテキストを取り出して TOC と同じ id を振る（#129） */
function idOf(children: ReactNode): string {
  const text = (function flatten(n: ReactNode): string {
    if (n == null || typeof n === 'boolean') return ''
    if (typeof n === 'string' || typeof n === 'number') return String(n)
    if (Array.isArray(n)) return n.map(flatten).join('')
    if (typeof n === 'object' && 'props' in n) return flatten((n.props as { children?: ReactNode }).children)
    return ''
  })(children)
  return headingSlug(text)
}

export default function MarkdownView({ body }: { body: string }) {
  return (
    <div className="text-sm text-zinc-800 leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1 id={idOf(children)} className="text-xl font-bold text-zinc-900 mt-6 mb-3 scroll-mt-20">{children}</h1>,
          h2: ({ children }) => <h2 id={idOf(children)} className="text-lg font-semibold text-zinc-900 mt-5 mb-2 border-b border-zinc-100 pb-1 scroll-mt-20">{children}</h2>,
          h3: ({ children }) => <h3 id={idOf(children)} className="text-base font-semibold text-zinc-800 mt-4 mb-2 scroll-mt-20">{children}</h3>,
          h4: ({ children }) => <h4 id={idOf(children)} className="text-sm font-semibold text-zinc-800 mt-3 mb-1 scroll-mt-20">{children}</h4>,
          p:  ({ children }) => <p className="my-3">{children}</p>,
          a:  ({ href, children }) => <a href={href} className="text-blue-600 underline hover:text-blue-800">{children}</a>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-zinc-200 pl-4 my-3 text-zinc-600 italic">{children}</blockquote>,
          hr: () => <hr className="my-5 border-zinc-200" />,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? '')
            if (isBlock) {
              return <code className={`${className ?? ''} block`}>{children}</code>
            }
            return <code className="bg-zinc-100 text-pink-700 px-1 py-0.5 rounded font-mono text-[0.85em]">{children}</code>
          },
          pre: ({ children }) => <pre className="bg-zinc-900 text-zinc-100 rounded-md p-3 my-3 overflow-x-auto text-xs font-mono">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-sm border border-zinc-200 border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-zinc-50">{children}</thead>,
          th: ({ children }) => <th className="border border-zinc-200 px-3 py-1.5 text-left font-medium text-zinc-600">{children}</th>,
          td: ({ children }) => <td className="border border-zinc-200 px-3 py-1.5 text-zinc-700">{children}</td>,
          // eslint-disable-next-line @next/next/no-img-element -- Markdown 中の任意の外部画像は寸法不明で next/image 化できない
          img: ({ src, alt }) => <img src={typeof src === 'string' ? src : undefined} alt={alt} className="max-w-full rounded-md my-3" />,
          strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
