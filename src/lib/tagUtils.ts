import { db } from './db'
import { tags } from './schema'
import { unstable_cache, revalidateTag } from 'next/cache'

export const CACHE_TAG_TAGS = 'tags'

/** 全タグ一覧（サーバー横断キャッシュ、60秒TTL） */
export const getAllTags = unstable_cache(
  async () => db.select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags).orderBy(tags.name),
  ['all_tags'],
  { tags: [CACHE_TAG_TAGS], revalidate: 60 },
)

/** タグ変更時にキャッシュを破棄 */
export function revalidateTags() {
  revalidateTag(CACHE_TAG_TAGS, 'max')
}
