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

/** 暫定で常時有効にする基盤モジュール（crm コア＋横断のワークスペース） */
export const ALWAYS_ON = ['crm-core', 'workspace', 'sales', 'expenses'] as const

export const MODULE_REGISTRY: Record<string, ModuleManifest> = {
  'crm-core': {
    id: 'crm-core', name: '顧客管理', category: 'crm',
    navItems: [
      { href: '/accounts',   label: '取引先', icon: '🏢' },
      { href: '/contacts',   label: '人物',   icon: '👤' },
    ],
    books: [
      { apiName: 'accounts',   label: '取引先' },
      { apiName: 'contacts',   label: '人物' },
    ],
    quickActions: [
      { label: '取引先の新規作成', icon: '🏢', kind: 'create', href: '/accounts/new', book: 'accounts' },
      { label: '取引先の一覧',     icon: '🏢', kind: 'list',   href: '/accounts',     book: 'accounts' },
      { label: '人物の新規作成',   icon: '👤', kind: 'create', href: '/contacts/new', book: 'contacts' },
      { label: '人物の一覧',       icon: '👤', kind: 'list',   href: '/contacts',     book: 'contacts' },
    ],
  },
  // 活動履歴・ToDo・Wiki は特定業務に属さず、取引先/商談/整備など**どこにでも紐づく**／
  // 全社で使う横断的な「作業」と「知識」の基盤。1つの「ワークスペース」に集約（常時有効・最上段）。
  'workspace': {
    id: 'workspace', name: 'ワークスペース', category: 'platform',
    navItems: [
      { href: '/activities', label: '活動履歴', icon: '🗓️' },
      { href: '/tasks',      label: 'ToDo',   icon: '✅' },
      { href: '/approvals',  label: '承認',   icon: '🛡️' },
      { href: '/wiki',       label: 'Wiki',   icon: '📖' },
    ],
    books: [
      { apiName: 'activities', label: '活動履歴' },
      { apiName: 'tasks',      label: 'ToDo' },
      { apiName: 'approvals',  label: '承認' },
      { apiName: 'wiki_pages', label: 'Wiki' },
    ],
    quickActions: [
      { label: '活動の記録',           icon: '📝', kind: 'log',    href: '/activities/new', book: 'activities' },
      { label: 'ToDoの新規作成',       icon: '✅', kind: 'create', href: '/tasks/new',      book: 'tasks' },
      { label: 'Wikiページの新規作成', icon: '📖', kind: 'create', href: '/wiki/new',       book: 'wiki_pages' },
      { label: 'Wikiを開く',           icon: '📖', kind: 'list',   href: '/wiki',           book: 'wiki_pages' },
    ],
  },
  'sales': {
    id: 'sales', name: '商談管理', category: 'crm', dependsOn: ['crm-core'],
    navItems: [
      { href: '/opportunities', label: '商談',     icon: '💼' },
      { href: '/forecast',      label: '売上予測', icon: '📊' },
    ],
    books: [
      { apiName: 'opportunities', label: '商談' },
      { apiName: 'forecast',      label: '売上予測' },
    ],
    quickActions: [
      { label: '商談の新規作成', icon: '💼', kind: 'create', href: '/opportunities/new', book: 'opportunities' },
      { label: '商談の一覧',     icon: '💼', kind: 'list',   href: '/opportunities',     book: 'opportunities' },
      { label: '売上予測を見る', icon: '📊', kind: 'list',   href: '/forecast',          book: 'forecast' },
    ],
  },
  'expenses': {
    id: 'expenses', name: '経費管理', category: 'crm', dependsOn: ['crm-core'],
    navItems: [{ href: '/expenses', label: '経費', icon: '💰' }],
    books: [{ apiName: 'expenses', label: '経費' }],
    quickActions: [
      { label: '経費の新規作成', icon: '💰', kind: 'create', href: '/expenses/new', book: 'expenses' },
      { label: '経費の一覧',     icon: '💰', kind: 'list',   href: '/expenses',     book: 'expenses' },
    ],
  },
  'inventory': {
    id: 'inventory', name: '在庫管理', category: 'erp', dependsOn: ['crm-core'],
    navItems: [
      { href: '/products',        label: '商品',     icon: '📦' },
      { href: '/warehouses',      label: '倉庫',     icon: '🏬' },
      { href: '/stock-movements', label: '在庫移動', icon: '🔁' },
    ],
    books: [
      { apiName: 'products',        label: '商品' },
      { apiName: 'warehouses',      label: '倉庫' },
      { apiName: 'stock_movements', label: '在庫移動' },
    ],
    quickActions: [
      { label: '商品の新規作成', icon: '📦', kind: 'create', href: '/products/new',         book: 'products' },
      { label: '商品の一覧',     icon: '📦', kind: 'list',   href: '/products',              book: 'products' },
      { label: '入出庫の登録',   icon: '🔁', kind: 'create', href: '/stock-movements/new',   book: 'stock_movements' },
    ],
  },
  'real-estate': {
    id: 'real-estate', name: '不動産管理', category: 'industry',
    dependsOn: ['crm-core', 'sales'], industry: 'real-estate',
    navItems: [
      { href: '/properties', label: '物件',       icon: '🏠' },
      { href: '/projects',   label: 'プロジェクト', icon: '🏗️' },
    ],
    books: [
      { apiName: 'properties', label: '物件' },
      { apiName: 'projects',   label: 'プロジェクト' },
    ],
    quickActions: [
      { label: '物件の新規作成', icon: '🏠', kind: 'create', href: '/properties/new', book: 'properties' },
      { label: '物件の一覧',     icon: '🏠', kind: 'list',   href: '/properties',     book: 'properties' },
      { label: 'プロジェクトの新規作成', icon: '🏗️', kind: 'create', href: '/projects/new', book: 'projects' },
      { label: 'プロジェクトの一覧',     icon: '🏗️', kind: 'list',   href: '/projects',     book: 'projects' },
    ],
  },
  'auto-body': {
    id: 'auto-body', name: '板金・自動車整備', category: 'industry',
    dependsOn: ['crm-core', 'sales'], industry: 'auto-body',
    navItems: [
      { href: '/maintenance',       label: '整備',     icon: '🔧' },
      { href: '/customer-vehicles', label: '顧客車両', icon: '🚙' },
      { href: '/vehicles',          label: '車両',     icon: '🚗' },
      { href: '/parts',             label: '部品',     icon: '🪛' },
      { href: '/receivables',       label: '売掛金',   icon: '💰' },
    ],
    books: [
      { apiName: 'maintenance_records', label: '整備' },
      { apiName: 'customer_vehicles',   label: '顧客車両' },
      { apiName: 'vehicles',            label: '車両' },
      { apiName: 'parts',               label: '部品' },
    ],
    quickActions: [
      { label: '車両の新規作成', icon: '🚗', kind: 'create', href: '/vehicles/new',    book: 'vehicles' },
      { label: '車両の一覧',     icon: '🚗', kind: 'list',   href: '/vehicles',        book: 'vehicles' },
      { label: '整備の新規作成', icon: '🔧', kind: 'create', href: '/maintenance/new', book: 'maintenance_records' },
      { label: '整備の一覧',     icon: '🔧', kind: 'list',   href: '/maintenance',     book: 'maintenance_records' },
      { label: '部品の新規作成', icon: '🪛', kind: 'create', href: '/parts/new',       book: 'parts' },
      { label: '部品の一覧',     icon: '🪛', kind: 'list',   href: '/parts',           book: 'parts' },
    ],
  },
  'staffing': {
    id: 'staffing', name: '人材手配', category: 'industry',
    dependsOn: ['crm-core', 'sales'], industry: 'staffing',
    navItems: [
      { href: '/assignments', label: '案件',   icon: '📋' },
      { href: '/staff',       label: 'スタッフ', icon: '🧑‍💼' },
      { href: '/invoices',    label: '売上・請求', icon: '💰' },
    ],
    books: [
      { apiName: 'assignments', label: '案件' },
      { apiName: 'staff',       label: 'スタッフ' },
    ],
    quickActions: [
      { label: 'クイック登録（AI起票）', icon: '✨', kind: 'wizard', href: '/quick/staffing', book: 'assignments',
        description: 'LINE等の文面を貼り付けてAIで案件を起票' },
      { label: '案件の新規作成',   icon: '📋', kind: 'create', href: '/assignments/new', book: 'assignments' },
      { label: '案件の一覧',       icon: '📋', kind: 'list',   href: '/assignments',     book: 'assignments' },
      { label: 'スタッフの新規作成', icon: '🧑‍💼', kind: 'create', href: '/staff/new',      book: 'staff' },
      { label: 'スタッフの一覧',     icon: '🧑‍💼', kind: 'list',   href: '/staff',          book: 'staff' },
      { label: '活動の記録',       icon: '📝', kind: 'log',    href: '/activities/new', book: 'activities' },
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
