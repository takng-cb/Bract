/**
 * Anthropic プロバイダの単体テスト。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { anthropicProvider } from './anthropic'
import { AIProviderError } from '../types'

const ORIGINAL_FETCH = globalThis.fetch

describe('anthropicProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('正常系: x-api-key と anthropic-version を送信し、content[].text を結合', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'World' },
          { type: 'thinking', text: 'should be ignored' },
        ],
        usage: { input_tokens: 42, output_tokens: 11 },
        stop_reason: 'end_turn',
      }),
    })

    const r = await anthropicProvider.complete({
      model: 'claude-3-5-haiku-20241022', apiKey: 'sk-ant-test',
      system: 'sys', user: 'usr',
    })

    expect(r.text).toBe('Hello World')
    expect(r.provider).toBe('anthropic')
    expect(r.usage?.inputTokens).toBe(42)
    expect(r.usage?.outputTokens).toBe(11)

    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://api.anthropic.com/v1/messages')
    expect(call[1].headers['x-api-key']).toBe('sk-ant-test')
    expect(call[1].headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(call[1].body)
    expect(body.model).toBe('claude-3-5-haiku-20241022')
    expect(body.system).toBe('sys')
    expect(body.messages).toEqual([{ role: 'user', content: 'usr' }])
  })

  it('HTTP エラー: AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 401,
      json: async () => ({ error: { message: 'invalid x-api-key' } }),
    })

    await expect(anthropicProvider.complete({
      model: 'claude-3-5-haiku-20241022', apiKey: 'bad', system: 's', user: 'u',
    })).rejects.toMatchObject({
      name: 'AIProviderError', provider: 'anthropic', statusCode: 401,
    })
  })

  it('thinking や tool_use しか含まれない応答は空とみなして AIProviderError を throw', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        content: [{ type: 'thinking', text: 'reasoning only' }],
        stop_reason: 'end_turn',
      }),
    })

    await expect(anthropicProvider.complete({
      model: 'm', apiKey: 'k', system: 's', user: 'u',
    })).rejects.toBeInstanceOf(AIProviderError)
  })

  it('temperature / maxTokens のデフォルト値が使われる', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })
    await anthropicProvider.complete({ model: 'm', apiKey: 'k', system: 's', user: 'u' })
    const body = JSON.parse((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.temperature).toBe(0.3)
    expect(body.max_tokens).toBe(1024)
  })
})
