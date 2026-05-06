import { db } from './db'
import { list_view_settings } from './schema'
import { eq } from 'drizzle-orm'

export async function getListViewColumns(objectType: string): Promise<string[]> {
  const row = await db
    .select({ columns: list_view_settings.columns })
    .from(list_view_settings)
    .where(eq(list_view_settings.object_type, objectType))
    .then((r) => r[0] ?? null)
  if (!row) return []
  try { return JSON.parse(row.columns) as string[] } catch { return [] }
}

export async function saveListViewColumns(objectType: string, columns: string[]): Promise<void> {
  await db
    .insert(list_view_settings)
    .values({ object_type: objectType, columns: JSON.stringify(columns) })
    .onConflictDoUpdate({
      target: list_view_settings.object_type,
      set: { columns: JSON.stringify(columns), updated_at: new Date() },
    })
}
