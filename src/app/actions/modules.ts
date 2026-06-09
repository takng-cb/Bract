'use server'

/**
 * モジュール ON/OFF トグル（#11）
 *
 * licenses.features.enabled_modules を編集して、再ビルドなしで機能を有効/無効化する。
 * - ALWAYS_ON（基盤）は変更不可。
 * - entitled_modules を超える有効化は不可（契約上限・ADR-0005）。
 * - 有効化時は依存モジュール（dependsOn）も併せて有効化する。
 * - enabled_modules 未設定（互換シム動作中）なら、現在の有効集合を初期値にして書き込む。
 */
import { requireAdmin } from '@/lib/auth'
import { getLicense } from '@/lib/license'
import { MODULE_REGISTRY, ALWAYS_ON, getEnabledModules } from '@/lib/modules/registry'
import { updateLicense } from '@/app/actions/license'
import { revalidatePath } from 'next/cache'

type Result = { ok: true } | { ok: false; error: string }

export async function setModuleEnabled(moduleId: string, on: boolean): Promise<Result> {
  await requireAdmin()

  const mod = MODULE_REGISTRY[moduleId]
  if (!mod) return { ok: false, error: '不明なモジュールです' }
  if ((ALWAYS_ON as readonly string[]).includes(moduleId)) {
    return { ok: false, error: '基盤モジュールは常時有効です（変更できません）' }
  }

  const lic = await getLicense()
  const features = { ...((lic?.features ?? {}) as Record<string, unknown>) } as {
    enabled_modules?: string[]
    entitled_modules?: string[]
  }

  const entitled = features.entitled_modules
  if (on && entitled && !entitled.includes(moduleId)) {
    return { ok: false, error: 'このモジュールは契約（entitled）に含まれていません' }
  }

  // 互換シム動作中（enabled_modules 未設定）なら現在の有効集合を初期値に
  const base = features.enabled_modules ?? (await getEnabledModules()).map((m) => m.id)
  const set = new Set(base.filter((id) => MODULE_REGISTRY[id]))

  if (on) {
    set.add(moduleId)
    for (const dep of mod.dependsOn ?? []) set.add(dep) // 依存も有効化
  } else {
    set.delete(moduleId)
  }
  // ALWAYS_ON は常に含める
  for (const a of ALWAYS_ON) set.add(a)

  features.enabled_modules = [...set]

  const res = await updateLicense({ features: features as never })
  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/admin/modules')
  revalidatePath('/', 'layout') // サイドバー（モジュール基準ナビ）を更新
  return { ok: true }
}
