/**
 * /wiki/[id]/edit — Wiki ページ 編集 (Issue #78)
 * 親ページ選択は循環回避のため自分自身＋子孫を除外する。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { wiki_pages } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import MarkdownEditor from '@/components/MarkdownEditor'
import SubmitButton from '@/components/SubmitButton'
import { updateWikiPage } from '@/app/actions/wiki'
import { requireBookRead } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function EditWikiPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('wiki_pages')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  if (!(await isModuleEnabled('workspace'))) notFound()
  await requireEditor()

  const [page, allPages] = await Promise.all([
    db.select().from(wiki_pages).where(eq(wiki_pages.id, id)).then((r) => r[0] ?? null),
    db.select({ id: wiki_pages.id, title: wiki_pages.title, parent_id: wiki_pages.parent_id })
      .from(wiki_pages).orderBy(asc(wiki_pages.title)),
  ])
  if (!page) notFound()

  // 子孫集合を算出して親候補から除外（循環防止）。自分自身も除外。
  const childrenOf = new Map<string, string[]>()
  for (const p of allPages) {
    if (!p.parent_id) continue
    const arr = childrenOf.get(p.parent_id) ?? []
    arr.push(p.id)
    childrenOf.set(p.parent_id, arr)
  }
  const excluded = new Set<string>([id])
  {
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const child of childrenOf.get(cur) ?? []) {
        if (!excluded.has(child)) { excluded.add(child); stack.push(child) }
      }
    }
  }
  const parentOptions = allPages.filter((p) => !excluded.has(p.id))

  async function action(formData: FormData) {
    'use server'
    await updateWikiPage(id, formData)
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/wiki" className="hover:text-zinc-600">Wiki</Link>
        <span className="mx-2">/</span>
        <Link href={`/wiki/${id}`} className="hover:text-zinc-600">{page.title}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Wiki ページを編集</h1>

      <form action={action} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">タイトル <span className="text-red-500">*</span></label>
          <input name="title" required defaultValue={page.title} className={field} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">親ページ</label>
          <SearchableSelect
            name="parent_id"
            options={parentOptions.map((p) => ({ value: p.id, label: p.title }))}
            defaultValue={page.parent_id ?? ''}
            placeholder="— ルート（親なし）—"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">本文（Markdown）</label>
          <MarkdownEditor name="body" defaultValue={page.body ?? ''} rows={16} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <SubmitButton>保存</SubmitButton>
          <Link href={`/wiki/${id}`} className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
        </div>
      </form>
    </div>
  )
}
