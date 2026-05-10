'use server'

import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { system_settings } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { ActivityType } from '@/lib/activityTypes'

const SETTING_KEY = 'activity_types'

/** 活動種別の一覧をまとめて保存。順序も保持される */
export async function saveActivityTypes(types: ActivityType[]): Promise<void> {
  await requireAdmin()

  // バリデーション: value 重複・空文字を弾く
  const seen = new Set<string>()
  const sanitized: ActivityType[] = []
  for (const t of types) {
    const value = (t.value ?? '').trim()
    const label = (t.label ?? '').trim()
    const icon  = (t.icon  ?? '').trim()
    if (!value || !label) continue
    if (seen.has(value)) continue
    seen.add(value)
    sanitized.push({
      value,
      label,
      icon: icon || '📋',
      color: t.color ?? undefined,
    })
  }
  if (sanitized.length === 0) throw new Error('活動種別を1つ以上指定してください')

  const json = JSON.stringify(sanitized)
  const existing = await db.select({ key: system_settings.key })
    .from(system_settings).where(eq(system_settings.key, SETTING_KEY))

  if (existing.length > 0) {
    await db.update(system_settings)
      .set({ value: json, updated_at: new Date() })
      .where(eq(system_settings.key, SETTING_KEY))
  } else {
    await db.insert(system_settings).values({ key: SETTING_KEY, value: json })
  }

  revalidatePath('/admin/objects')
  revalidatePath('/activities')
}
