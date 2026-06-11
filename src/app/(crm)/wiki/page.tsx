/**
 * /wiki 一覧 — Wiki（社内ナレッジ）module (Issue #78)
 * 検索ボックス（?q= → title/body ILIKE）＋ 階層ツリー表示。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { wiki_pages } from '@/lib/schema'
import { asc, or, ilike } from 'drizzle-orm'
import { canEdit } from '@/lib/auth'
import { NavIcon } from '@/lib/navIcon'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

type Row = { id: string; title: string; parent_id: string | null }

export default async function WikiListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireBookRead('wiki_pages')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('workspace'))) notFound()
  const { q } = await searchParams
  const query = (q ?? '').trim()

  const [rows, edit] = await Promise.all([
    db.select({ id: wiki_pages.id, title: wiki_pages.title, parent_id: wiki_pages.parent_id })
      .from(wiki_pages)
      .where(query ? or(ilike(wiki_pages.title, `%${query}%`), ilike(wiki_pages.body, `%${query}%`)) : undefined)
      .orderBy(asc(wiki_pages.title)),
    canEdit(),
  ])

  // 検索時はフラット表示。未検索時は階層ツリー表示。
  const childrenOf = new Map<string | null, Row[]>()
  if (!query) {
    const ids = new Set(rows.map((r) => r.id))
    for (const r of rows) {
      // 親が存在しない（孤児）場合はルート扱い
      const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null
      const arr = childrenOf.get(key) ?? []
      arr.push(r)
      childrenOf.set(key, arr)
    }
  }

  function renderTree(parentId: string | null, depth: number): React.ReactNode {
    const kids = childrenOf.get(parentId) ?? []
    if (kids.length === 0) return null
    return (
      <ul className={depth === 0 ? '' : 'border-l border-zinc-100'}>
        {kids.map((r) => (
          <li key={r.id}>
            <Link
              href={`/wiki/${r.id}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 text-sm border-b border-zinc-100"
              style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
            >
              <NavIcon icon="📖" className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="text-blue-600 hover:underline font-medium truncate">{r.title}</span>
            </Link>
            {renderTree(r.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="📖" className="w-6 h-6" /> Wiki</h1>
          <p className="text-sm text-zinc-500 mt-1">社内ナレッジ・全 {rows.length} 件</p>
        </div>
        {edit && (
          <Link href="/wiki/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            ＋ 新規ページ
          </Link>
        )}
      </div>

      <form method="get" className="mb-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="タイトル・本文を検索…"
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="📖" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">{query ? '該当するページがありません' : 'Wiki ページがまだありません'}</p>
          {!query && <p className="text-sm mt-1">「新規ページ」ボタンから作成してください</p>}
        </div>
      ) : query ? (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/wiki/${r.id}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-50 text-sm">
                  <NavIcon icon="📖" className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-blue-600 hover:underline font-medium truncate">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {renderTree(null, 0)}
        </div>
      )}
    </div>
  )
}
