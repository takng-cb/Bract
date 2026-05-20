/**
 * Gemini プロバイダの単体テスト。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { geminiProvider } from './gemini'
import { AIProviderError } from '../types'

const ORIGINAL_FETCH = globalThis.fetch

describe('geminiProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('正常系: systemInstruction + contents 形式で送信、candidates[0].content.parts.text を結合', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'part1 ' }, { text: 'part2' }] },
          finishReason: 'STOP',
        }],
        usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 30 },
      }),
    })

    const r = await geminiProvider.complete({
      model: 'gemini-1.5-flash', apiKey: 'AIzaTest',
      system: 'sys', user: 'usr',
    })

    expect(r.text).toBe('part1 part2')
    expect(r.provider).toBe('gemini')
    expect(r.usage?.inputTokens).toBe(80)
    expect(r.usage?.outputTokens).toBe(30)

    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent')
    expect(call[0]).toContain('key=AIzaTest')
    const body = JSON.parse(call[1].body)
    expect(body.systemInstruction.parts[0].text).toBe('sys')
    expect(body.contents[0].parts[0].text).toBe('usr')
  })

  it('HTTP エラー: error.message を使って AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 403,
      json: async () => ({ error: { message: 'API key not valid' } }),
    })

    await expect(geminiProvider.complete({
      model: 'gemini-1.5-flash', apiKey: 'bad', system: 's', user: 'u',
    })).rejects.toMatchObject({
      name: 'AIProviderError', provider: 'gemini', statusCode: 403,
    })
  })

  it('空のレスポンス（candidates 無し）でも AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    })
    await expect(geminiProvider.complete({
      model: 'm', apiKey: 'k', system: 's', user: 'u',
    })).rejects.toBeInstanceOf(AIProviderError)
  })

  it('finishReason=SAFETY のような空コンテンツでも明示的に AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }),
    })
    await expect(geminiProvider.complete({
      model: 'm', apiKey: 'k', system: 's', user: 'u',
    })).rejects.toThrow(/SAFETY/)
  })
})
