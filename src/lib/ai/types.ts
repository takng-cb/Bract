/**
 * AI プロバイダ抽象化 — 共通型定義
 *
 * 複数の AI プロバイダ（Groq / Gemini / Anthropic Claude）を同一インタフェースで
 * 扱うための型を定義する。
 *
 * 設計方針:
 * - 各プロバイダ実装は同じ `AIProvider.complete(req)` 関数シグネチャを持つ
 * - 呼び出し側はプロバイダの違いを意識しない（client.ts のファクトリ経由）
 * - ストリーミングは現状未対応（要約用途では非ストリーミングで十分）
 * - エラーは Error を throw（呼び出し側でキャッチして UI に出す）
 */

/** サポートする AI プロバイダの種類 */
export type AIProviderKind = 'groq' | 'gemini' | 'anthropic'

/** プロバイダ表示名（UI / ログ用） */
export const AI_PROVIDER_LABELS: Record<AIProviderKind, string> = {
  groq:      'Groq',
  gemini:    'Google Gemini',
  anthropic: 'Anthropic Claude',
}

/** 各プロバイダのデフォルトモデル（安価・高速・要約向き） */
export const AI_DEFAULT_MODELS: Record<AIProviderKind, string> = {
  groq:      'llama-3.3-70b-versatile',
  gemini:    'gemini-1.5-flash',
  anthropic: 'claude-3-5-haiku-20241022',
}

/** AI 呼び出しのリクエスト */
export type AICompletionRequest = {
  /** モデル名（プロバイダ依存） */
  model: string
  /** API キー */
  apiKey: string
  /** システムプロンプト（指示文） */
  system: string
  /** ユーザー入力（要約対象データなど） */
  user: string
  /** 最大トークン数 (省略時 1024) */
  maxTokens?: number
  /** 0.0〜2.0、低いほど決定的（省略時 0.3 = 要約向き） */
  temperature?: number
  /** タイムアウト ms (省略時 30000) */
  timeoutMs?: number
}

/** AI 呼び出しの結果 */
export type AICompletionResult = {
  /** 生成されたテキスト */
  text: string
  /** 使用したモデル */
  model: string
  /** 使用プロバイダ */
  provider: AIProviderKind
  /** トークン消費 (取得できない場合 null) */
  usage?: {
    inputTokens?: number
    outputTokens?: number
  } | null
}

/** プロバイダの実装が満たすインタフェース */
export interface AIProvider {
  readonly kind: AIProviderKind
  complete(req: AICompletionRequest): Promise<AICompletionResult>
}

/** AI 機能が無効化されている場合に投げるエラー */
export class AIDisabledError extends Error {
  constructor(message = 'AI 機能が無効です。システム設定で AI プロバイダと API キーを設定してください。') {
    super(message)
    this.name = 'AIDisabledError'
  }
}

/** AI 呼び出しが失敗した場合のエラー */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProviderKind,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}
