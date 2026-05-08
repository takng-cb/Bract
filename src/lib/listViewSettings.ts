import { db } from './db'
import { list_view_settings } from './schema'
import { eq } from 'drizzle-orm'
import { unstable_cache, revalidateTag } from 'next/cache'

export const CACHE_TAG_LIST_VIEW = 'list_view_settings'

const _getListViewColumns = unstable_cache(
  async (objectType: string): Promise<string[]> => {
    const row = await db
      .select({ columns: list_view_settings.columns })
      .from(list_view_settings)
      .where(eq(list_view_settings.object_type, objectType))
      .then((r) => r[0] ?? null)
    if (!row) return []
    try { return JSON.parse(row.columns) as string[] } catch { return [] }
  },
  ['list_view_columns'],
  { tags: [CACHE_TAG_LIST_VIEW], revalidate: 300 },
)

export async function getListViewColumns(objectType: string): Promise<string[]> {
  return _getListViewColumns(objectType)
}

export async function saveListViewColumns(objectType: string, columns: string[]): Promise<void> {
  await db
    .insert(list_view_settings)
    .values({ object_type: objectType, columns: JSON.stringify(columns) })
    .onConflictDoUpdate({
      target: list_view_settings.object_type,
      set: { columns: JSON.stringify(columns), updated_at: new Date() },
    })
  revalidateTag(CACHE_TAG_LIST_VIEW, 'max')
}
