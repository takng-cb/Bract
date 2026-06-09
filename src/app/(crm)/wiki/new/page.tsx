/**
 * /wiki/new — Wiki ページ 新規作成 (Issue #78)
 * ?title= で初期タイトル、?parent= で親ページを事前選択（[[missing]] 導線対応）。
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { wiki_pages } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import SearchableSelect from '@/components/SearchableSelect'
import MarkdownEditor from '@/components/MarkdownEditor'
import { createWikiPage } from '@/app/actions/wiki'

export const dynamic = 'force-dynamic'

export default async function NewWikiPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; parent?: string }>
}) {
  if (!(await isModuleEnabled('wiki'))) notFound()
  await requireEditor()
  const { title, parent } = await searchParams

  const pages = await db.select({ id: wiki_pages.id, title: wiki_pages.title })
    .from(wiki_pages).orderBy(asc(wiki_pages.title))

  async function action(formData: FormData) {
    'use server'
    await createWikiPage(formData)
  }

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/wiki" className="hover:text-zinc-600">Wiki</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規ページ</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Wiki ページを作成</h1>

      <form action={action} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">タイトル <span className="text-red-500">*</span></label>
          <input name="title" required defaultValue={title ?? ''} className={field} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">親ページ</label>
          <SearchableSelect
            name="parent_id"
            options={pages.map((p) => ({ value: p.id, label: p.title }))}
            defaultValue={parent ?? ''}
            placeholder="— ルート（親なし）—"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">本文（Markdown）</label>
          <MarkdownEditor name="body" rows={16} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
          <Link href="/wiki" className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">キャンセル</Link>
        </div>
      </form>
    </div>
  )
}
