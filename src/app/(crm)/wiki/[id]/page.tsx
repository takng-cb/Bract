/**
 * /wiki/[id] — Wiki ページ 詳細 (Issue #78)
 * RecordHeader ヒーロー（BookOpen）＋ 祖先パンくず ＋ Markdown 本文 ＋ 子ページ一覧。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, SquarePen, History } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { wiki_pages } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import RecordHeader, { type Crumb } from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import MarkdownView from '@/components/MarkdownView'
import RecordLinksSection from '@/components/RecordLinksSection'
import { extractHeadings } from '@/lib/markdownToc'
import { resolveWikiLinks } from '@/lib/wiki'
import { deleteWikiPage } from '@/app/actions/wiki'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function WikiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('wiki_pages')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  if (!(await isModuleEnabled('workspace'))) notFound()

  const [page, allPages] = await Promise.all([
    db.select().from(wiki_pages).where(eq(wiki_pages.id, id)).then((r) => r[0] ?? null),
    db.select({ id: wiki_pages.id, title: wiki_pages.title, parent_id: wiki_pages.parent_id })
      .from(wiki_pages).orderBy(asc(wiki_pages.title)),
  ])
  if (!page) notFound()

  const byId = new Map(allPages.map((p) => [p.id, p]))
  const titleToId = new Map(allPages.map((p) => [p.title, p.id]))

  // 祖先チェーン（自分は含めない、ルート→直近親の順）。循環ガード付き。
  const ancestors: { id: string; title: string }[] = []
  {
    const seen = new Set<string>([id])
    let cur = page.parent_id
    while (cur && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      const p = byId.get(cur)!
      ancestors.unshift({ id: p.id, title: p.title })
      cur = p.parent_id
    }
  }

  const parent = page.parent_id ? byId.get(page.parent_id) ?? null : null
  const children = allPages.filter((p) => p.parent_id === id)

  const crumbs: Crumb[] = [
    { label: 'Wiki', href: '/wiki' },
    ...ancestors.map((a) => ({ label: a.title, href: `/wiki/${a.id}` })),
    { label: page.title },
  ]

  const renderedBody = page.body ? resolveWikiLinks(page.body, titleToId) : ''
  // 目次（#129）: 見出しが2つ以上ある時だけ表示
  const toc = extractHeadings(renderedBody)

  async function handleDelete() {
    'use server'
    await deleteWikiPage(id)
  }

  const updated = page.updated_at ? new Date(page.updated_at).toLocaleDateString('ja-JP') : '—'

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <RecordHeader
        crumbs={crumbs}
        title={page.title}
        avatar={<BookOpen className="w-6 h-6" strokeWidth={2.25} />}
        meta={[
          { label: '更新日', value: updated },
          ...(parent ? [{ label: '親ページ', value: <Link href={`/wiki/${parent.id}`} className="text-blue-600 hover:underline">{parent.title}</Link> }] : []),
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* 版差分（#129） */}
            <Link href={`/wiki/${id}/history`} className="px-3 py-1.5 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50" title="変更履歴・版差分">
              <History className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} aria-hidden /> 履歴
            </Link>
            <AuthGuard minRole="editor">
              <div className="flex items-center gap-2">
                <Link href={`/wiki/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
                <DeleteButton action={handleDelete} confirmMessage="このページを削除しますか？子ページは親なし（ルート）になります。" />
              </div>
            </AuthGuard>
          </div>
        }
      />

      {/* 目次（見出しから自動生成 #129） */}
      {toc.length >= 2 && (
        <nav className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 mb-4" aria-label="目次">
          <p className="text-xs font-semibold text-zinc-500 mb-2">目次</p>
          <ul className="space-y-1">
            {toc.map((h, i) => (
              <li key={i} style={{ paddingLeft: `${(h.level - 1) * 14}px` }}>
                <a href={`#${h.slug}`} className="text-sm text-blue-700 hover:underline">{h.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* 本文 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        {renderedBody.trim() ? (
          <MarkdownView body={renderedBody} />
        ) : (
          <p className="text-sm text-zinc-400">本文がまだありません。</p>
        )}
      </div>

      {/* 子ページ */}
      {children.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-700">子ページ <span className="text-zinc-400 font-normal">({children.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/wiki/new?parent=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 子ページを追加</Link>
            </AuthGuard>
          </div>
          <ul className="divide-y divide-zinc-100">
            {children.map((c) => (
              <li key={c.id}>
                <Link href={`/wiki/${c.id}`} className="flex items-center gap-2 py-2 text-sm">
                  <NavIcon icon="📖" className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-blue-600 hover:underline font-medium truncate">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6"><RecordLinksSection selfApi="wiki" selfId={id} /></div>

      <div className="mt-6 text-right text-xs text-zinc-400 font-mono">
        <NavIcon icon="📖" className="w-3 h-3 inline mr-1" />{id}
      </div>
    </div>
  )
}
