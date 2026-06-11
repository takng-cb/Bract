/**
 * クイックアクセス（REQ-0016）— 純粋関数・追加のみ
 *
 * 有効モジュール群から「モジュール見出し付きクイックアクション群」を組み立てる。
 * ランチャー(QuickLauncher) と モジュールホームのクイック操作セクションが共用。
 */
import type { ModuleManifest, QuickAction, ModuleCategory } from './types'

export type QuickActionGroup = {
  moduleId: string
  moduleName: string
  category: ModuleCategory
  actions: QuickAction[]
}

const CATEGORY_ORDER: ModuleCategory[] = ['platform', 'crm', 'erp', 'industry']

/** 有効モジュール群 → クイックアクション群（カテゴリ順） */
export function buildQuickActionGroups(modules: ModuleManifest[]): QuickActionGroup[] {
  return [...modules]
    .filter((m) => (m.quickActions?.length ?? 0) > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .map((m) => ({
      moduleId: m.id,
      moduleName: m.name,
      category: m.category,
      actions: m.quickActions ?? [],
    }))
}

// ── クイック操作ウィザード用：モジュール → ブック ツリー（REQ-0022）──────
export type QuickBook = {
  apiName: string
  label: string
  icon?: string
  /** 一覧（閲覧）への遷移先 */
  listHref: string
  /** 新規作成（手動）への遷移先 */
  newHref: string
  /** book_records ベース（book_fields 駆動）なら true → 汎用AI作成が可能 */
  custom: boolean
  /** ウィザードの AI 作成（テキスト/画像/URL→確認→作成）に対応するブックか（#49） */
  aiCreate: boolean
  /** AI 検索（自然文→フィルタ）に対応するブックか */
  aiSearch: boolean
  /** 専用 AI 起票ウィザードがある場合の遷移先（例: staffing → /quick/staffing） */
  aiWizardHref?: string
  /** 閲覧専用（売上予測など、作成・検索の対象にならないビュー）。閲覧フローでのみ表示 */
  viewOnly: boolean
}
export type QuickModule = {
  id: string
  name: string
  category: ModuleCategory
  icon?: string
  books: QuickBook[]
}

/** 専用 AI ウィザードを持つブック（apiName → href）。汎用AIが無い typed ブックの受け皿 */
const AI_WIZARD_HREF: Record<string, string> = {
  assignments: '/quick/staffing',
}

/** ウィザードの AI 作成に対応する typed ブック（#49・quickAi.ts の TYPED_SPECS と一致） */
const AI_TYPED_BOOKS = new Set(['accounts', 'contacts', 'vehicles', 'parts', 'properties', 'tasks', 'activities'])

/** AI 検索（自然文→フィルタ）対応ブック（aiSearch.ts の SEARCH_FIELDS と一致） */
const AI_SEARCH_BOOKS = new Set(['accounts', 'contacts', 'opportunities', 'tasks', 'expenses', 'activities'])

/** 閲覧専用ブック（作成・検索の対象外。閲覧フローでのみ表示） */
const VIEW_ONLY_BOOKS = new Set(['forecast'])

/**
 * 有効モジュール群 → 「モジュール → ブック」ツリー。
 * listHref/newHref は各モジュールの navItems（label 一致）から解決し、
 * 無ければカスタムオブジェクト規約 `/books/<apiName>` にフォールバックする。
 */
export function buildModuleBooks(modules: ModuleManifest[]): QuickModule[] {
  return [...modules]
    .filter((m) => (m.books?.length ?? 0) > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .map((m) => {
      const firstNavIcon = m.navItems?.[0]?.icon
      const books: QuickBook[] = (m.books ?? []).map((b) => {
        const nav = m.navItems?.find((n) => n.label === b.label)
        const listHref = nav?.href ?? `/books/${b.apiName}`
        const custom = listHref.startsWith('/books/')
        return {
          apiName: b.apiName,
          label: b.label,
          icon: nav?.icon,
          listHref,
          newHref: `${listHref}/new`,
          custom,
          aiCreate: custom || AI_TYPED_BOOKS.has(b.apiName),
          aiSearch: AI_SEARCH_BOOKS.has(b.apiName),
          aiWizardHref: AI_WIZARD_HREF[b.apiName],
          viewOnly: VIEW_ONLY_BOOKS.has(b.apiName),
        }
      })
      return { id: m.id, name: m.name, category: m.category, icon: firstNavIcon, books }
    })
}
