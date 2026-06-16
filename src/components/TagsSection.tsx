import { db } from '@/lib/db'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { taggables, tags } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { addTagToObject, removeTagFromObject } from '@/app/actions/tags'

type Props = {
  objectType: 'account' | 'contact' | 'opportunity' | 'property' | 'project'
  objectId: string
  revalidatePath: string
}

export default async function TagsSection({ objectType, objectId, revalidatePath: path }: Props) {
  const [appliedRows, allTags] = await Promise.all([
    db.select({
      id:      taggables.id,
      tag_id:  taggables.tag_id,
      tags: {
        id:    tags.id,
        name:  tags.name,
        color: tags.color,
      },
    })
      .from(taggables)
      .innerJoin(tags, eq(taggables.tag_id, tags.id))
      .where(and(
        eq(taggables.object_type, objectType),
        eq(taggables.object_id, objectId),
      )),
    db.select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .orderBy(tags.name),
  ])

  const appliedIds = new Set(appliedRows.map((a) => a.tag_id))
  const remaining  = allTags.filter((t) => !appliedIds.has(t.id))

  async function handleAdd(formData: FormData) {
    'use server'
    const tagId = formData.get('tag_id') as string
    if (!tagId) return
    await addTagToObject(tagId, objectType, objectId, path)
  }

  async function handleRemove(formData: FormData) {
    'use server'
    const taggableId = formData.get('taggable_id') as string
    await removeTagFromObject(taggableId, path)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {appliedRows.map((a) => {
        const tag = a.tags
        return (
          <form key={a.id} action={handleRemove} className="inline-flex">
            <input type="hidden" name="taggable_id" value={a.id} />
            <button
              type="submit"
              title="タグを外す"
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <span className="opacity-70 text-[10px]">✕</span>
            </button>
          </form>
        )
      })}

      {remaining.length > 0 && (
        <form action={handleAdd} className="inline-flex items-center gap-1">
          <select
            name="tag_id"
            className="border border-zinc-300 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">タグを追加...</option>
            {remaining.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded hover:bg-zinc-200 transition-colors"
          >
            追加
          </button>
        </form>
      )}

      {/* 新規タグ作成（タグが未定義でも常に導線を出す） */}
      <Link
        href="/tags/new"
        target="_blank"
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 border border-dashed border-zinc-300 rounded-md hover:border-zinc-400 hover:text-zinc-700 transition-colors"
        title="新しいタグを作成（別タブ）"
      >
        <Plus className="w-3 h-3 shrink-0" strokeWidth={2.5} />
        {allTags.length === 0 ? 'タグを作成' : '新規'}
      </Link>
    </div>
  )
}
