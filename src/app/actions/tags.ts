'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createTag(formData: FormData) {
  const name  = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#71717a'
  if (!name) throw new Error('タグ名は必須です')

  const { error } = await supabase.from('tags').insert({ name, color })
  if (error) throw new Error(error.message)
  redirect('/tags')
}

export async function updateTag(id: string, formData: FormData) {
  const name  = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#71717a'
  if (!name) throw new Error('タグ名は必須です')

  const { error } = await supabase
    .from('tags')
    .update({ name, color, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  redirect('/tags')
}

export async function deleteTag(id: string) {
  await supabase.from('tags').delete().eq('id', id)
  revalidatePath('/tags')
}

export async function addTagToObject(
  tagId: string,
  objectType: string,
  objectId: string,
  revalidate: string,
) {
  await supabase.from('taggables').insert({
    tag_id: tagId, object_type: objectType, object_id: objectId,
  })
  revalidatePath(revalidate)
}

export async function removeTagFromObject(taggableId: string, revalidate: string) {
  await supabase.from('taggables').delete().eq('id', taggableId)
  revalidatePath(revalidate)
}
