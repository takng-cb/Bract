/**
 * Google Gemini プロバイダ実装。
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
 *
 * docs: https://ai.google.dev/api/generate-content
 */
import type { AIProvider, AICompletionRequest, AICompletionResult } from '../types'
import { AIProviderError } from '../types'

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
  error?: { message?: string; code?: number; status?: string }
}

export const geminiProvider: AIProvider = {
  kind: 'gemini',
  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 30000)
    try {
      const url = `${ENDPOINT_BASE}/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Gemini は system instruction を別フィールドで受け取る
          systemInstruction: {
            parts: [{ text: req.system }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                ...(req.images ?? []).map((img) => ({
                  inlineData: { mimeType: img.mediaType, data: img.dataBase64 },
                })),
                { text: req.user },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: req.maxTokens ?? 1024,
            temperature:     req.temperature ?? 0.3,
          },
        }),
        signal: controller.signal,
      })

      const json = await res.json().catch(() => ({})) as GeminiResponse

      if (!res.ok) {
        const rawMsg = json?.error?.message ?? `HTTP ${res.status}`
        if (res.status === 429 || /rate.?limit/i.test(String(rawMsg))) {
          console.warn('[ai] rate limited (gemini):', rawMsg)
          throw new AIProviderError('AI の利用上限に達しました。数分おいてからお試しください（続く場合は管理者に AI プランの見直しをご相談ください）。', 'gemini', res.status)
        }
        const msg = rawMsg
        throw new AIProviderError(msg, 'gemini', res.status)
      }

      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!text) {
        const reason = json.candidates?.[0]?.finishReason ?? 'unknown'
        throw new AIProviderError(`Gemini API: 空のレスポンス (finishReason=${reason})`, 'gemini', res.status)
      }

      return {
        text,
        model:    req.model,
        provider: 'gemini',
        usage: {
          inputTokens:  json.usageMetadata?.promptTokenCount,
          outputTokens: json.usageMetadata?.candidatesTokenCount,
        },
      }
    } catch (e) {
      if (e instanceof AIProviderError) throw e
      if (e instanceof Error && e.name === 'AbortError') {
        throw new AIProviderError(`Gemini API: タイムアウト (${req.timeoutMs ?? 30000}ms)`, 'gemini')
      }
      throw new AIProviderError(`Gemini API: ${e instanceof Error ? e.message : String(e)}`, 'gemini')
    } finally {
      clearTimeout(timer)
    }
  },
}
