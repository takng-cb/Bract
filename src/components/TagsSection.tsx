import { supabase } from '@/lib/supabase'
import { addTagToObject, removeTagFromObject } from '@/app/actions/tags'

type Props = {
  objectType: 'account' | 'contact' | 'opportunity'
  objectId: string
  revalidatePath: string
}

export default async function TagsSection({ objectType, objectId, revalidatePath: path }: Props) {
  const [taggablesRes, allTagsRes] = await Promise.all([
    supabase
      .from('taggables')
      .select('id, tag_id, tags(id, name, color)')
      .eq('object_type', objectType)
      .eq('object_id', objectId),
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  const applied    = (taggablesRes.data ?? []) as unknown as {
    id: string; tag_id: string; tags: { id: string; name: string; color: string }
  }[]
  const allTags    = allTagsRes.data ?? []
  const appliedIds = new Set(applied.map((a) => a.tag_id))
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
      {/* 付与済みタグ */}
      {applied.map((a) => {
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

      {/* タグ追加 */}
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

      {applied.length === 0 && remaining.length === 0 && (
        <span className="text-xs text-zinc-400">タグがありません</span>
      )}
    </div>
  )
}
