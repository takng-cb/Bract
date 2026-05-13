'use server'

import { db } from '@/lib/db'
import { tags, taggables } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth'

export async function createTag(formData: FormData) {
  await requireEditor()
  const name  = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#71717a'
  if (!name) throw new Error('タグ名は必須です')

  await db.insert(tags).values({ name, color })
  redirect('/tags')
}

export async function updateTag(id: string, formData: FormData) {
  await requireEditor()
  const name  = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#71717a'
  if (!name) throw new Error('タグ名は必須です')

  await db.update(tags)
    .set({ name, color, updated_at: new Date() })
    .where(eq(tags.id, id))
  redirect('/tags')
}

export async function deleteTag(id: string) {
  await requireEditor()
  await db.delete(tags).where(eq(tags.id, id))
  revalidatePath('/tags')
}

export async function addTagToObject(
  tagId: string,
  objectType: string,
  objectId: string,
  revalidate: string,
) {
  await requireEditor()
  await db.insert(taggables)
    .values({ tag_id: tagId, object_type: objectType, object_id: objectId })
    .onConflictDoNothing()
  revalidatePath(revalidate)
}

export async function removeTagFromObject(taggableId: string, revalidate: string) {
  await requireEditor()
  await db.delete(taggables).where(eq(taggables.id, taggableId))
  revalidatePath(revalidate)
}
