/**
 * Groq プロバイダ実装。
 *
 * Groq は OpenAI 互換の Chat Completions API を提供する。
 *   POST https://api.groq.com/openai/v1/chat/completions
 *
 * docs: https://console.groq.com/docs/api-reference
 */
import type { AIProvider, AICompletionRequest, AICompletionResult } from '../types'
import { AIProviderError } from '../types'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  error?: { message?: string; type?: string }
}

export const groqProvider: AIProvider = {
  kind: 'groq',
  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    if (req.images && req.images.length > 0) {
      throw new AIProviderError('Groq では画像解析に未対応です。画像入力を使う場合は AI プロバイダを Anthropic または Gemini に設定してください。', 'groq')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 30000)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${req.apiKey}`,
        },
        body: JSON.stringify({
          model:       req.model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user',   content: req.user },
          ],
          max_tokens:  req.maxTokens ?? 1024,
          temperature: req.temperature ?? 0.3,
        }),
        signal: controller.signal,
      })

      const json = await res.json().catch(() => ({})) as GroqResponse

      if (!res.ok) {
        const rawMsg = json?.error?.message ?? `HTTP ${res.status}`
        if (res.status === 429 || /rate.?limit/i.test(String(rawMsg))) {
          console.warn('[ai] rate limited (groq):', rawMsg)
          throw new AIProviderError('AI の利用上限に達しました。数分おいてからお試しください（続く場合は管理者に AI プランの見直しをご相談ください）。', 'groq', res.status)
        }
        const msg = rawMsg
        throw new AIProviderError(msg, 'groq', res.status)
      }

      const text = json.choices?.[0]?.message?.content ?? ''
      if (!text) {
        throw new AIProviderError('Groq API: 空のレスポンス', 'groq', res.status)
      }

      return {
        text,
        model:    req.model,
        provider: 'groq',
        usage: {
          inputTokens:  json.usage?.prompt_tokens,
          outputTokens: json.usage?.completion_tokens,
        },
      }
    } catch (e) {
      if (e instanceof AIProviderError) throw e
      if (e instanceof Error && e.name === 'AbortError') {
        throw new AIProviderError(`Groq API: タイムアウト (${req.timeoutMs ?? 30000}ms)`, 'groq')
      }
      throw new AIProviderError(`Groq API: ${e instanceof Error ? e.message : String(e)}`, 'groq')
    } finally {
      clearTimeout(timer)
    }
  },
}
