/**
 * クイックアクセス（REQ-0016）— 純粋関数・追加のみ
 *
 * 有効モジュール群から「モジュール見出し付きクイックアクション群」を組み立てる。
 * ランチャー(QuickLauncher) と ダッシュボードのクイック起点セクションが共用。
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
