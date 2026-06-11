/**
 * モジュールレジストリ — 型定義（#10 / ADR-0001/0016/0018/0019）
 *
 * 語彙：モジュール（機能パッケージ）> ブック（旧オブジェクト＝データの種類/表）> レコード。
 * ここは追加のみ（既存挙動は変えない）。実際のゲーティング/nav 配線は段階的に行う。
 */
import type { Industry } from '@/lib/industry'

export type ModuleCategory = 'platform' | 'crm' | 'erp' | 'industry'

export type NavItemDef = {
  href: string
  label: string
  icon: string
}

/** モジュールが束ねるブック（旧オブジェクト）への参照 */
export type BookRef = {
  /** book 定義の api_name（現状は book_definitions.api_name と一致） */
  apiName: string
  label: string
}

/**
 * クイックアクション（REQ-0016）：モジュールの「業務フロー起点」操作。
 * - create: レコード新規作成（href へ遷移）
 * - log:    やりとり/活動の記録（href へ遷移）
 * - wizard: AI クイック登録（貼付→AI構造化→確認→反映。draft-then-apply）
 */
export type QuickAction = {
  label: string
  icon: string
  kind: 'create' | 'log' | 'list' | 'wizard'
  /** create/log/list の遷移先。wizard は省略可（ランチャー内でウィザードを開く） */
  href?: string
  /** 対象ブック（任意・将来のAIコントラクト紐付け用） */
  book?: string
  description?: string
}

export interface ModuleManifest {
  id: string
  name: string
  category: ModuleCategory
  /** 依存モジュール（有効化時に自動解決。ADR-0019-1/2） */
  dependsOn?: string[]
  /** サイドバーに足す項目（モジュール基準UI用） */
  navItems?: NavItemDef[]
  /** このモジュールが所有するブック */
  books?: BookRef[]
  /** クイックアクセス（業務フロー起点・REQ-0016） */
  quickActions?: QuickAction[]
  /** 旧 activeIndustry 互換：このモジュールが対応する業種（フォールバック導出用） */
  industry?: Industry
}

/** モジュール無効時に投げる（Server Action ゲート用） */
export class ModuleNotEnabledError extends Error {
  constructor(public readonly moduleId: string, message?: string) {
    super(message ?? `モジュール "${moduleId}" は有効化されていません。`)
    this.name = 'ModuleNotEnabledError'
  }
}
