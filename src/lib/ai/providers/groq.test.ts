/**
 * Groq プロバイダの単体テスト。
 * グローバル fetch をモックして、リクエスト整形・レスポンスパース・エラーハンドリングを検証。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { groqProvider } from './groq'
import { AIProviderError } from '../types'

const ORIGINAL_FETCH = globalThis.fetch

describe('groqProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('正常系: messages 形式でリクエストを送り、choices[0].message.content をテキストとして返す', async () => {
    const mockResponse = {
      choices: [{ message: { content: '要約結果テキスト' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })

    const r = await groqProvider.complete({
      model: 'llama-3.3-70b-versatile',
      apiKey: 'gsk_test',
      system: 'sys prompt',
      user:   'user data',
    })

    expect(r.text).toBe('要約結果テキスト')
    expect(r.provider).toBe('groq')
    expect(r.model).toBe('llama-3.3-70b-versatile')
    expect(r.usage?.inputTokens).toBe(100)
    expect(r.usage?.outputTokens).toBe(50)

    // リクエストの内容を検証
    const fetchCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    const body = JSON.parse(fetchCall[1].body)
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys prompt' },
      { role: 'user',   content: 'user data' },
    ])
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer gsk_test')
  })

  it('HTTP エラー: error.message を使って AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    })

    await expect(groqProvider.complete({
      model: 'llama-3.3-70b-versatile',
      apiKey: 'bad',
      system: 's', user: 'u',
    })).rejects.toMatchObject({
      name: 'AIProviderError',
      provider: 'groq',
      statusCode: 401,
    })
  })

  it('空のレスポンス: AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    })

    await expect(groqProvider.complete({
      model: 'x', apiKey: 'k', system: 's', user: 'u',
    })).rejects.toBeInstanceOf(AIProviderError)
  })

  it('temperature / maxTokens のデフォルト値 (0.3 / 1024) が使われる', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    await groqProvider.complete({ model: 'm', apiKey: 'k', system: 's', user: 'u' })
    const body = JSON.parse((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.temperature).toBe(0.3)
    expect(body.max_tokens).toBe(1024)
  })

  it('明示的な temperature / maxTokens が優先される', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    await groqProvider.complete({ model: 'm', apiKey: 'k', system: 's', user: 'u', temperature: 0.9, maxTokens: 256 })
    const body = JSON.parse((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.temperature).toBe(0.9)
    expect(body.max_tokens).toBe(256)
  })

  it('network error: AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'))
    await expect(groqProvider.complete({
      model: 'm', apiKey: 'k', system: 's', user: 'u',
    })).rejects.toMatchObject({
      name: 'AIProviderError',
      provider: 'groq',
    })
  })
})
