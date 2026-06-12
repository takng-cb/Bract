/**
 * Anthropic Claude プロバイダ実装。
 *
 *   POST https://api.anthropic.com/v1/messages
 *
 * docs: https://docs.anthropic.com/en/api/messages
 */
import type { AIProvider, AICompletionRequest, AICompletionResult } from '../types'
import { AIProviderError } from '../types'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: { type?: string; message?: string }
  stop_reason?: string
}

export const anthropicProvider: AIProvider = {
  kind: 'anthropic',
  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 30000)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         req.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model:       req.model,
          max_tokens:  req.maxTokens ?? 1024,
          temperature: req.temperature ?? 0.3,
          system:      req.system,
          messages: [
            {
              role: 'user',
              content: (req.images && req.images.length > 0)
                ? [
                    ...req.images.map((img) => ({
                      type: 'image',
                      source: { type: 'base64', media_type: img.mediaType, data: img.dataBase64 },
                    })),
                    { type: 'text', text: req.user },
                  ]
                : req.user,
            },
          ],
        }),
        signal: controller.signal,
      })

      const json = await res.json().catch(() => ({})) as AnthropicResponse

      if (!res.ok) {
        const rawMsg = json?.error?.message ?? `HTTP ${res.status}`
        if (res.status === 429 || /rate.?limit/i.test(String(rawMsg))) {
          console.warn('[ai] rate limited (anthropic):', rawMsg)
          throw new AIProviderError('AI の利用上限に達しました。数分おいてからお試しください（続く場合は管理者に AI プランの見直しをご相談ください）。', 'anthropic', res.status)
        }
        const msg = rawMsg
        throw new AIProviderError(msg, 'anthropic', res.status)
      }

      const text = (json.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('')
      if (!text) {
        throw new AIProviderError(`Anthropic API: 空のレスポンス (stop_reason=${json.stop_reason ?? 'unknown'})`, 'anthropic', res.status)
      }

      return {
        text,
        model:    req.model,
        provider: 'anthropic',
        usage: {
          inputTokens:  json.usage?.input_tokens,
          outputTokens: json.usage?.output_tokens,
        },
      }
    } catch (e) {
      if (e instanceof AIProviderError) throw e
      if (e instanceof Error && e.name === 'AbortError') {
        throw new AIProviderError(`Anthropic API: タイムアウト (${req.timeoutMs ?? 30000}ms)`, 'anthropic')
      }
      throw new AIProviderError(`Anthropic API: ${e instanceof Error ? e.message : String(e)}`, 'anthropic')
    } finally {
      clearTimeout(timer)
    }
  },
}
