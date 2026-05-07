'use server'
import { db } from '@/lib/db'
import { object_definitions, field_definitions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { isAdmin } from '@/lib/auth'
import { CACHE_TAG_OBJECTS, CACHE_TAG_FIELDS } from '@/lib/objectMetadata'

// ────────────────────────────────────────────────────────────────
// オブジェクト定義 CRUD
// ────────────────────────────────────────────────────────────────

export async function createObjectDef(formData: FormData) {
  if (!(await isAdmin())) throw new Error('権限がありません')

  const api_name     = (formData.get('api_name')     as string).trim().toLowerCase().replace(/\s+/g, '_')
  const label        = (formData.get('label')        as string).trim()
  const label_plural = (formData.get('label_plural') as string).trim()
  const icon         = (formData.get('icon')         as string).trim() || '📦'

  if (!api_name || !label || !label_plural) throw new Error('必須項目が不足しています')
  if (!/^[a-z][a-z0-9_]*$/.test(api_name)) throw new Error('API名は英小文字・数字・アンダースコアのみ使用できます（先頭は英字）')

  await db.insert(object_definitions).values({
    api_name, label, label_plural, icon,
    is_builtin:  false,
    nav_enabled: true,
    sort_order:  100,
  })
  revalidateTag(CACHE_TAG_OBJECTS, 'max')
  revalidatePath('/admin/objects')
  revalidatePath('/', 'layout')
}

export async function updateObjectDef(id: string, formData: FormData) {
  if (!(await isAdmin())) throw new Error('権限がありません')

  const label        = (formData.get('label')        as string).trim()
  const label_plural = (formData.get('label_plural') as string).trim()
  const icon         = (formData.get('icon')         as string).trim() || '📦'
  const nav_enabled  = formData.get('nav_enabled') === 'on'

  if (!label || !label_plural) throw new Error('必須項目が不足しています')

  await db.update(object_definitions)
    .set({ label, label_plural, icon, nav_enabled, updated_at: new Date() })
    .where(eq(object_definitions.id, id))

  revalidateTag(CACHE_TAG_OBJECTS, 'max')
  revalidatePath('/admin/objects')
  revalidatePath('/', 'layout')
}

export async function deleteObjectDef(id: string) {
  if (!(await isAdmin())) throw new Error('権限がありません')

  const obj = await db.select({ is_builtin: object_definitions.is_builtin })
    .from(object_definitions).where(eq(object_definitions.id, id))
    .then((r) => r[0])

  if (!obj) throw new Error('オブジェクトが見つかりません')
  if (obj.is_builtin) throw new Error('組み込みオブジェクトは削除できません')

  await db.delete(object_definitions).where(eq(object_definitions.id, id))
  revalidateTag(CACHE_TAG_OBJECTS, 'max')
  revalidateTag(CACHE_TAG_FIELDS, 'max')
  revalidatePath('/admin/objects')
  revalidatePath('/', 'layout')
}

// ────────────────────────────────────────────────────────────────
// フィールド定義 CRUD
// ────────────────────────────────────────────────────────────────

export async function createFieldDef(objectId: string, formData: FormData) {
  if (!(await isAdmin())) throw new Error('権限がありません')

  const api_name   = (formData.get('api_name')   as string).trim().toLowerCase().replace(/\s+/g, '_')
  const label      = (formData.get('label')      as string).trim()
  const field_type = (formData.get('field_type') as string).trim()
  const optionsRaw = (formData.get('options')    as string | null)?.trim() ?? ''
  const is_required = formData.get('is_required') === 'on'

  if (!label || !field_type) throw new Error('必須項目が不足しています')
  // セクションは api_name が自動生成（section_xxxxx 形式）なのでバリデーションをスキップ
  if (!api_name) throw new Error('API名が指定されていません')
  if (field_type !== 'section' && !/^[a-z][a-z0-9_]*$/.test(api_name)) {
    throw new Error('API名は英小文字・数字・アンダースコアのみ使用できます（先頭は英字）')
  }

  // select の場合 options を JSON 配列に変換
  let options: string | null = null
  if (field_type === 'select' && optionsRaw) {
    const arr = optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    options = JSON.stringify(arr)
  }

  await db.insert(field_definitions).values({
    object_id: objectId,
    api_name, label, field_type,
    options,
    is_required,
    is_builtin: false,
    is_visible: true,
    sort_order: 100,
  })
  revalidateTag(CACHE_TAG_FIELDS, 'max')
  revalidatePath(`/admin/objects/${objectId}`)
}

export async function updateFieldDef(fieldId: string, objectId: string, formData: FormData) {
  if (!(await isAdmin())) throw new Error('権限がありません')

  const label      = (formData.get('label')      as string).trim()
  const field_type = (formData.get('field_type') as string).trim()
  const optionsRaw = (formData.get('options')    as string | null)?.trim() ?? ''
  const is_required = formData.get('is_required') === 'on'
  const is_visible  = formData.get('is_visible')  !== 'off'

  if (!label || !field_type) throw new Error('必須項目が不足しています')

  let options: string | null = null
  if (field_type === 'select' && optionsRaw) {
    const arr = optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    options = JSON.stringify(arr)
  }

  await db.update(field_definitions)
    .set({ label, field_type, options, is_required, is_visible, updated_at: new Date() })
    .where(eq(field_definitions.id, fieldId))

  revalidateTag(CACHE_TAG_FIELDS, 'max')
  revalidatePath(`/admin/objects/${objectId}`)
}

/**
 * フィールドを上下に移動する（隣接フィールドと sort_order を入れ替える）
 * direction: 'up' | 'down'
 */
export async function moveFieldDef(fieldId: string, objectId: string, direction: 'up' | 'down') {
  if (!(await isAdmin())) throw new Error('権限がありません')

  // 同オブジェクトの全フィールドを sort_order 順で取得
  const all = await db
    .select({ id: field_definitions.id, sort_order: field_definitions.sort_order })
    .from(field_definitions)
    .where(eq(field_definitions.object_id, objectId))
    .orderBy(field_definitions.sort_order, field_definitions.created_at)

  const idx = all.findIndex((f) => f.id === fieldId)
  if (idx < 0) return

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return // 端なので何もしない

  const a = all[idx]
  const b = all[swapIdx]

  // sort_order が同値の場合は連番を振り直す
  const aOrder = idx * 10
  const bOrder = swapIdx * 10

  await Promise.all([
    db.update(field_definitions).set({ sort_order: bOrder }).where(eq(field_definitions.id, a.id)),
    db.update(field_definitions).set({ sort_order: aOrder }).where(eq(field_definitions.id, b.id)),
  ])

  revalidateTag(CACHE_TAG_FIELDS, 'max')
  revalidatePath(`/admin/objects/${objectId}`)
}

export async function deleteFieldDef(fieldId: string, objectId: string) {
  if (!(await isAdmin())) throw new Error('権限がありません')

  const field = await db.select({ is_builtin: field_definitions.is_builtin })
    .from(field_definitions).where(eq(field_definitions.id, fieldId))
    .then((r) => r[0])

  if (!field) throw new Error('フィールドが見つかりません')
  if (field.is_builtin) throw new Error('組み込みフィールドは削除できません')

  await db.delete(field_definitions).where(eq(field_definitions.id, fieldId))
  revalidateTag(CACHE_TAG_FIELDS, 'max')
  revalidatePath(`/admin/objects/${objectId}`)
}
