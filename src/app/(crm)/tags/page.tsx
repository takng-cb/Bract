export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { tags, taggables } from '@/lib/schema'
import { desc } from 'drizzle-orm'
import Link from 'next/link'
import { deleteTag } from '@/app/actions/tags'
import TagDeleteButton from '@/components/TagDeleteButton'

export default async function TagsPage() {
  const [allTags, countRows] = await Promise.all([
    db.select({ id: tags.id, name: tags.name, color: tags.color, created_at: tags.created_at })
      .from(tags).orderBy(tags.name),
    db.select({ tag_id: taggables.tag_id }).from(taggables),
  ])

  const countMap: Record<string, number> = {}
  for (const r of countRows) {
    countMap[r.tag_id] = (countMap[r.tag_id] ?? 0) + 1
  }

  async function handleDelete(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await deleteTag(id)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">タグ管理</h1>
          <p className="text-sm text-zinc-500 mt-1">{allTags.length} 件</p>
        </div>
        <Link
          href="/tags/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ 新規作成
        </Link>
      </div>

      {allTags.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">🏷️</p>
          <p className="text-lg font-medium">タグがまだありません</p>
          <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">タグ</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600">使用数</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {allTags.map((tag) => (
                <tr key={tag.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {countMap[tag.id] ?? 0} 件
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/tags/${tag.id}/edit`}
                        className="text-xs text-zinc-400 hover:text-zinc-700"
                      >
                        編集
                      </Link>
                      <TagDeleteButton
                        tagId={tag.id}
                        tagName={tag.name}
                        action={handleDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
