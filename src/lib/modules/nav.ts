/**
 * モジュール基準ナビ（#22 / REQ-0015）— 純粋関数・追加のみ
 *
 * 有効モジュール群を「モジュール見出し > 配下リンク」のグループに変換する。
 * サイドバー(layout.tsx)への配線は段階的に行う（本ファイルはまだ未配線）。
 */
import type { ModuleManifest, NavItemDef, ModuleCategory } from './types'

export type ModuleNavGroup = {
  moduleId: string
  moduleName: string
  category: ModuleCategory
  items: NavItemDef[]
}

const CATEGORY_ORDER: ModuleCategory[] = ['platform', 'crm', 'erp', 'industry']

/** 有効モジュール群 → モジュール見出し付き nav グループ（カテゴリ順） */
export function buildModuleNav(modules: ModuleManifest[]): ModuleNavGroup[] {
  return [...modules]
    .filter((m) => (m.navItems?.length ?? 0) > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .map((m) => ({
      moduleId: m.id,
      moduleName: m.name,
      category: m.category,
      items: m.navItems ?? [],
    }))
}
