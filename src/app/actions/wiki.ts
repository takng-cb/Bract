'use server'

/**
 * Wiki（社内ナレッジ / Issue #78）の Server Actions。
 * wiki_pages の CRUD。delete 時は子の parent_id が FK の ON DELETE SET NULL で
 * 自動的に NULL になる（孤児はルート扱い）。
 */
import { db } from '@/lib/db'
import { trashRecord } from '@/lib/trash'
import { wiki_pages, change_logs } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { withSaveToast } from '@/lib/saveToast'
import { requirePermission } from '@/lib/permissions'
import { logChanges } from '@/lib/changeLog'

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export async function createWikiPage(formData: FormData): Promise<string> {
  await requirePermission('wiki_pages', 'create')
  const title = s(formData, 'title')
  if (!title) throw new Error('タイトルは必須です')

  const [row] = await db.insert(wiki_pages).values({
    title,
    body:      s(formData, 'body'),
    parent_id: s(formData, 'parent_id'),
    owner_id:  s(formData, 'owner_id'),
  }).returning({ id: wiki_pages.id })

  revalidatePath('/wiki')
  redirect(withSaveToast(`/wiki/${row.id}`, 'created'))
}

export async function updateWikiPage(id: string, formData: FormData): Promise<void> {
  await requirePermission('wiki_pages', 'update')
  const title = s(formData, 'title')
  if (!title) throw new Error('タイトルは必須です')

  // 自分自身を親に指定するのは循環になるため弾く
  const parentId = s(formData, 'parent_id')
  if (parentId === id) throw new Error('自分自身を親ページに指定できません')

  // 版差分（#129）: 変更前を取得して change_logs に記録（body の履歴が版になる）
  const before = await db.select({ title: wiki_pages.title, body: wiki_pages.body })
    .from(wiki_pages).where(eq(wiki_pages.id, id)).then((r) => r[0] ?? null)

  const body = s(formData, 'body')
  await db.update(wiki_pages).set({
    title,
    body,
    parent_id:  parentId,
    owner_id:   s(formData, 'owner_id'),
    updated_at: new Date(),
  }).where(eq(wiki_pages.id, id))

  if (before) {
    await logChanges('wiki_pages', id,
      { title: { label: 'タイトル', value: before.title }, body: { label: '本文', value: before.body } },
      { title: { label: 'タイトル', value: title },        body: { label: '本文', value: body } },
    )
  }

  revalidatePath('/wiki')
  revalidatePath(`/wiki/${id}`)
  redirect(withSaveToast(`/wiki/${id}`, 'saved'))
}

/**
 * 指定した版（change_logs の本文変更行）の内容に本文を戻す（#129）。
 * 「戻す」操作自体も新しい版として記録される（履歴は前進のみ）。
 */
export async function restoreWikiBody(id: string, changeLogId: string, restoreTo: 'old' | 'new'): Promise<void> {
  await requirePermission('wiki_pages', 'update')

  const log = await db.select({ old_value: change_logs.old_value, new_value: change_logs.new_value })
    .from(change_logs)
    .where(and(
      eq(change_logs.id, changeLogId),
      eq(change_logs.object_type, 'wiki_pages'),
      eq(change_logs.object_id, id),
      eq(change_logs.field_name, 'body'),
    ))
    .then((r) => r[0] ?? null)
  if (!log) throw new Error('対象の版が見つかりません')

  const targetBody = restoreTo === 'old' ? log.old_value : log.new_value
  const before = await db.select({ body: wiki_pages.body })
    .from(wiki_pages).where(eq(wiki_pages.id, id)).then((r) => r[0] ?? null)
  if (!before) throw new Error('ページが見つかりません')

  await db.update(wiki_pages).set({ body: targetBody, updated_at: new Date() }).where(eq(wiki_pages.id, id))
  await logChanges('wiki_pages', id,
    { body: { label: '本文', value: before.body } },
    { body: { label: '本文', value: targetBody } },
  )

  revalidatePath(`/wiki/${id}`)
  revalidatePath(`/wiki/${id}/history`)
  redirect(withSaveToast(`/wiki/${id}`, 'saved'))
}

export async function deleteWikiPage(id: string): Promise<void> {
  await requirePermission('wiki_pages', 'delete')
  await trashRecord('wiki_pages', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  // 子ページの parent_id は FK の ON DELETE SET NULL で自動的に NULL になる
  await db.delete(wiki_pages).where(eq(wiki_pages.id, id))
  revalidatePath('/wiki')
  redirect(withSaveToast('/wiki', 'deleted'))
}
