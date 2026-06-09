'use server'

/**
 * Wiki（社内ナレッジ / Issue #78）の Server Actions。
 * wiki_pages の CRUD。delete 時は子の parent_id が FK の ON DELETE SET NULL で
 * 自動的に NULL になる（孤児はルート扱い）。
 */
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { wiki_pages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export async function createWikiPage(formData: FormData): Promise<string> {
  await requireEditor()
  const title = s(formData, 'title')
  if (!title) throw new Error('タイトルは必須です')

  const [row] = await db.insert(wiki_pages).values({
    title,
    body:      s(formData, 'body'),
    parent_id: s(formData, 'parent_id'),
    owner_id:  s(formData, 'owner_id'),
  }).returning({ id: wiki_pages.id })

  revalidatePath('/wiki')
  redirect(`/wiki/${row.id}`)
}

export async function updateWikiPage(id: string, formData: FormData): Promise<void> {
  await requireEditor()
  const title = s(formData, 'title')
  if (!title) throw new Error('タイトルは必須です')

  // 自分自身を親に指定するのは循環になるため弾く
  const parentId = s(formData, 'parent_id')
  if (parentId === id) throw new Error('自分自身を親ページに指定できません')

  await db.update(wiki_pages).set({
    title,
    body:       s(formData, 'body'),
    parent_id:  parentId,
    owner_id:   s(formData, 'owner_id'),
    updated_at: new Date(),
  }).where(eq(wiki_pages.id, id))

  revalidatePath('/wiki')
  revalidatePath(`/wiki/${id}`)
  redirect(`/wiki/${id}`)
}

export async function deleteWikiPage(id: string): Promise<void> {
  await requireEditor()
  // 子ページの parent_id は FK の ON DELETE SET NULL で自動的に NULL になる
  await db.delete(wiki_pages).where(eq(wiki_pages.id, id))
  revalidatePath('/wiki')
  redirect('/wiki')
}
