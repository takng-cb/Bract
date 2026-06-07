/**
 * モジュールレジストリ（#10 / ADR-0016/0018/0019）
 *
 * 追加のみ・挙動非変更：本ファイルはまだ pages/nav から配線していない。
 * 有効モジュールの導出ロジックと判定 API を提供する土台。
 *
 * 有効集合 = enabled_modules ∩ entitled_modules ∩ ビルドプロファイル ＋ 依存解決
 *   - enabled_modules 未設定時は現行 activeIndustry から導出（互換シム＝本番無影響）
 */
import 'server-only'
import { cache } from 'react'
import { getLicense, isLicenseActive } from '@/lib/license'
import { activeIndustry } from '@/lib/industry'
import type { ModuleManifest, ModuleCategory } from './types'
import { ModuleNotEnabledError } from './types'

/** 同梱モジュール群（ビルドプロファイル）。未設定は 'all'（ADR-0002） */
const BUILD_PROFILE = (process.env.BRACT_BUILD_PROFILE ?? 'all') as 'crm' | 'crm+erp' | 'all'

/** 暫定で常時有効にする基盤モジュール（crm コア） */
const ALWAYS_ON = ['crm-core', 'sales', 'expenses'] as const

export const MODULE_REGISTRY: Record<string, ModuleManifest> = {
  'crm-core': {
    id: 'crm-core', name: 'CRM コア', category: 'crm',
    navItems: [
      { href: '/accounts',   label: '取引先', icon: '🏢' },
      { href: '/contacts',   label: '人物',   icon: '👤' },
      { href: '/activities', label: '活動履歴', icon: '📋' },
      { href: '/tasks',      label: 'ToDo',   icon: '✅' },
    ],
    books: [
      { apiName: 'accounts',   label: '取引先' },
      { apiName: 'contacts',   label: '人物' },
      { apiName: 'activities', label: '活動履歴' },
      { apiName: 'tasks',      label: 'ToDo' },
    ],
  },
  'sales': {
    id: 'sales', name: '営業', category: 'crm', dependsOn: ['crm-core'],
    navItems: [
      { href: '/opportunities', label: '商談',     icon: '💼' },
      { href: '/forecast',      label: '売上予測', icon: '📊' },
    ],
    books: [{ apiName: 'opportunities', label: '商談' }],
  },
  'expenses': {
    id: 'expenses', name: '経費', category: 'crm', dependsOn: ['crm-core'],
    navItems: [{ href: '/expenses', label: '経費管理', icon: '💰' }],
    books: [{ apiName: 'expenses', label: '経費' }],
  },
  'real-estate': {
    id: 'real-estate', name: '不動産', category: 'industry',
    dependsOn: ['crm-core', 'sales'], industry: 'real-estate',
    navItems: [{ href: '/properties', label: '物件', icon: '🏠' }],
    books: [{ apiName: 'properties', label: '物件' }],
  },
  'auto-body': {
    id: 'auto-body', name: '板金・自動車整備', category: 'industry',
    dependsOn: ['crm-core', 'sales'], industry: 'auto-body',
    navItems: [
      { href: '/vehicles', label: '車両', icon: '🚗' },
      { href: '/parts',    label: '部品', icon: '🔧' },
    ],
    books: [
      { apiName: 'vehicles', label: '車両' },
      { apiName: 'parts',    label: '部品' },
    ],
  },
  'staffing': {
    id: 'staffing', name: '人材手配', category: 'industry',
    dependsOn: ['crm-core', 'sales'], industry: 'staffing',
    navItems: [
      { href: '/assignments', label: '案件',   icon: '📦' },
      { href: '/staff',       label: 'スタッフ', icon: '🧑‍💼' },
    ],
    books: [
      { apiName: 'assignments', label: '案件' },
      { apiName: 'staff',       label: 'スタッフ' },
    ],
  },
}

function categoryInProfile(cat: ModuleCategory): boolean {
  if (BUILD_PROFILE === 'all') return true
  // platform / crm は常に同梱
  if (cat === 'platform' || cat === 'crm') return true
  // crm+erp は erp も同梱（industry は除外）
  if (BUILD_PROFILE === 'crm+erp') return cat === 'erp'
  // 'crm' プロファイルは platform + crm のみ
  return false
}

/** dependsOn を再帰解決して集合に含める（ADR-0019-2） */
function resolveDeps(ids: Set<string>): Set<string> {
  const out = new Set(ids)
  let changed = true
  while (changed) {
    changed = false
    for (const id of [...out]) {
      const m = MODULE_REGISTRY[id]
      if (!m?.dependsOn) continue
      for (const dep of m.dependsOn) {
        if (!out.has(dep)) { out.add(dep); changed = true }
      }
    }
  }
  return out
}

type ModuleFeatures = { enabled_modules?: string[]; entitled_modules?: string[] }

/** 有効モジュールID集合を導出（互換シム込み） */
async function enabledModuleIds(): Promise<Set<string>> {
  const set = new Set<string>(ALWAYS_ON)

  const lic = await getLicense()
  const features = (lic?.features ?? undefined) as ModuleFeatures | undefined

  if ((await isLicenseActive()) && features?.enabled_modules?.length) {
    const entitled = features.entitled_modules
    for (const id of features.enabled_modules) {
      if (!MODULE_REGISTRY[id]) continue
      if (entitled && !entitled.includes(id)) continue // entitled 上限（ADR-0005）
      set.add(id)
    }
  } else if (activeIndustry !== 'base' && MODULE_REGISTRY[activeIndustry]) {
    // 互換シム：enabled_modules 未設定 → 現行 activeIndustry を有効化
    set.add(activeIndustry)
  }

  // ビルドプロファイル ∩
  for (const id of [...set]) {
    const m = MODULE_REGISTRY[id]
    if (!m || !categoryInProfile(m.category)) set.delete(id)
  }

  return resolveDeps(set)
}

/** 有効化されたモジュール一覧（依存解決済み・リクエスト内キャッシュ） */
export const getEnabledModules = cache(async (): Promise<ModuleManifest[]> => {
  const ids = await enabledModuleIds()
  return [...ids]
    .map((id) => MODULE_REGISTRY[id])
    .filter((m): m is ModuleManifest => Boolean(m))
})

/** 単一モジュールの有効判定 */
export async function isModuleEnabled(id: string): Promise<boolean> {
  return (await enabledModuleIds()).has(id)
}

/** Server Action 冒頭ゲート（無効なら throw） */
export async function ensureModuleEnabled(id: string): Promise<void> {
  if (!(await isModuleEnabled(id))) throw new ModuleNotEnabledError(id)
}
