'use server'

import { db } from '@/lib/db'
import { saved_views } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId, isAdmin } from '@/lib/auth'

export async function createSavedView(
  objectType: string,
  name: string,
  filterParams: string[],
  groupParams: string,
  scope: 'user' | 'system',
  path: string,
): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  if (scope === 'system' && !(await isAdmin())) throw new Error('Admin required')

  await db.insert(saved_views).values({
    object_type:   objectType,
    name:          name.trim(),
    filter_params: JSON.stringify(filterParams),
    group_params:  groupParams,
    scope,
    user_id:       scope === 'user' ? userId : null,
    is_default:    false,
  })
  revalidatePath(path)
}

export async function deleteSavedView(id: string, path: string): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  const admin = await isAdmin()

  const [view] = await db.select().from(saved_views).where(eq(saved_views.id, id))
  if (!view) return
  if (view.scope === 'user' && view.user_id !== userId) throw new Error('Forbidden')
  if (view.scope === 'system' && !admin) throw new Error('Admin required')

  await db.delete(saved_views).where(eq(saved_views.id, id))
  revalidatePath(path)
}

export async function setDefaultView(
  id: string,
  objectType: string,
  scope: 'user' | 'system',
  path: string,
): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  const admin = await isAdmin()
  if (scope === 'system' && !admin) throw new Error('Admin required')

  // 同スコープの既存デフォルトをリセット
  if (scope === 'user') {
    await db.update(saved_views)
      .set({ is_default: false })
      .where(and(
        eq(saved_views.object_type, objectType),
        eq(saved_views.scope, 'user'),
        eq(saved_views.user_id, userId),
      ))
  } else {
    await db.update(saved_views)
      .set({ is_default: false })
      .where(and(eq(saved_views.object_type, objectType), eq(saved_views.scope, 'system')))
  }

  await db.update(saved_views).set({ is_default: true }).where(eq(saved_views.id, id))
  revalidatePath(path)
}

export async function clearDefaultView(
  objectType: string,
  scope: 'user' | 'system',
  path: string,
): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  const admin = await isAdmin()
  if (scope === 'system' && !admin) throw new Error('Admin required')

  if (scope === 'user') {
    await db.update(saved_views)
      .set({ is_default: false })
      .where(and(
        eq(saved_views.object_type, objectType),
        eq(saved_views.scope, 'user'),
        eq(saved_views.user_id, userId),
      ))
  } else {
    await db.update(saved_views)
      .set({ is_default: false })
      .where(and(eq(saved_views.object_type, objectType), eq(saved_views.scope, 'system')))
  }
  revalidatePath(path)
}
