/**
 * AI クライアント - 設定に応じて適切なプロバイダを選択して呼び出す。
 *
 * 使い方:
 *   ```ts
 *   import { callAI } from '@/lib/ai/client'
 *   const result = await callAI({
 *     system: 'あなたは要約アシスタントです',
 *     user:   '以下を要約: ...',
 *   })
 *   console.log(result.text)
 *   ```
 *
 * 内部で:
 *   1. system_settings から AI 設定を取得
 *   2. プロバイダ + API キーが揃っているか確認
 *   3. 該当プロバイダの complete を呼ぶ
 *
 * 失敗時は AIDisabledError / AIProviderError を throw。
 */
import { ensureAIEnabled } from './config'
import type { AIProvider, AICompletionResult, AIImageInput } from './types'
import { groqProvider } from './providers/groq'
import { geminiProvider } from './providers/gemini'
import { anthropicProvider } from './providers/anthropic'
import type { AIProviderKind } from './types'

const PROVIDERS: Record<AIProviderKind, AIProvider> = {
  groq:      groqProvider,
  gemini:    geminiProvider,
  anthropic: anthropicProvider,
}

export type CallAIInput = {
  system: string
  user:   string
  /** Vision 入力（対応プロバイダのみ） */
  images?: AIImageInput[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

/**
 * 設定された AI プロバイダで補完を呼び出す。
 * 設定が不正な場合は AIDisabledError を throw。
 */
export async function callAI(input: CallAIInput): Promise<AICompletionResult> {
  const cfg = await ensureAIEnabled()
  const provider = PROVIDERS[cfg.provider]
  return provider.complete({
    model:       cfg.model,
    apiKey:      cfg.apiKey,
    system:      input.system,
    user:        input.user,
    images:      input.images,
    maxTokens:   input.maxTokens,
    temperature: input.temperature,
    timeoutMs:   input.timeoutMs,
  })
}
