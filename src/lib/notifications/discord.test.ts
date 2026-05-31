/**
 * Discord 通知ヘルパーのテスト (Issue #25)
 *
 * fetch をモックして、URL の組み立て、payload、エラーハンドリングを検証。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  notifyDiscord,
  notifyDiscordText,
  deploySuccessEmbed,
  deployErrorEmbed,
  DISCORD_COLOR,
} from './discord'

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_URL   = process.env.DISCORD_WEBHOOK_URL

describe('notifyDiscord', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token'
  })
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    if (ORIGINAL_URL === undefined) delete process.env.DISCORD_WEBHOOK_URL
    else process.env.DISCORD_WEBHOOK_URL = ORIGINAL_URL
    vi.restoreAllMocks()
  })

  it('正常系: webhook URL に POST、payload を JSON で送る', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 204,
      text: async () => '',
    })

    const r = await notifyDiscord({ content: 'Hello' })

    expect(r.ok).toBe(true)
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://discord.com/api/webhooks/test/token')
    expect(call[1].method).toBe('POST')
    expect(call[1].headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(call[1].body)
    expect(body.content).toBe('Hello')
  })

  it('env DISCORD_WEBHOOK_URL 未設定なら skip して error 返す', async () => {
    delete process.env.DISCORD_WEBHOOK_URL
    const r = await notifyDiscord({ content: 'Hello' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('not set')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('HTTP エラー時は ok=false を返すが throw しない', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 500,
      text: async () => 'internal error',
    })
    const r = await notifyDiscord({ content: 'Hello' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('500')
  })

  it('network error 時も ok=false を返すが throw しない', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'))
    const r = await notifyDiscord({ content: 'Hello' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('network down')
  })
})

describe('notifyDiscordText', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token'
  })
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    if (ORIGINAL_URL === undefined) delete process.env.DISCORD_WEBHOOK_URL
    else process.env.DISCORD_WEBHOOK_URL = ORIGINAL_URL
  })

  it('content を 2000 文字に切り詰める', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 204, text: async () => '',
    })

    const longMsg = 'a'.repeat(3000)
    await notifyDiscordText(longMsg)

    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.content.length).toBe(2000)
  })
})

describe('deploySuccessEmbed', () => {
  it('必須項目を含む embed を生成、color=green', () => {
    const e = deploySuccessEmbed({
      project: 'bract-crm',
      url:     'bract-crm.vercel.app',
      branch:  'main',
      commitSha:     'abcd1234567890',
      commitMessage: 'feat: 新機能',
      commitAuthor:  'Test User',
      inspectorUrl:  'https://vercel.com/test/inspector',
    })

    expect(e.title).toBe('🟢 デプロイ成功')
    expect(e.color).toBe(DISCORD_COLOR.success)
    expect(e.description).toContain('bract-crm.vercel.app')
    expect(e.url).toBe('https://vercel.com/test/inspector')
    expect(e.timestamp).toBeDefined()
    expect(e.fields?.find((f) => f.name === 'プロジェクト')?.value).toBe('bract-crm')
    expect(e.fields?.find((f) => f.name === 'ブランチ')?.value).toBe('main')
    // commit sha は 7 文字に短縮
    expect(e.fields?.find((f) => f.name === 'コミット')?.value).toBe('abcd123')
  })

  it('optional フィールドが無くてもエラーにならない', () => {
    const e = deploySuccessEmbed({
      project: 'p',
      url:     'u',
    })
    expect(e.title).toBe('🟢 デプロイ成功')
    expect(e.fields?.length).toBe(1)  // project のみ
  })
})

describe('deployErrorEmbed', () => {
  it('color=red、エラー情報を含む', () => {
    const e = deployErrorEmbed({
      project:      'bract-crm',
      branch:       'main',
      commitSha:    'deadbeef000',
      errorMessage: 'TypeError: foo is undefined',
      inspectorUrl: 'https://vercel.com/test/inspector',
    })

    expect(e.title).toBe('🔴 デプロイ失敗')
    expect(e.color).toBe(DISCORD_COLOR.error)
    expect(e.fields?.find((f) => f.name === 'エラー')?.value).toContain('TypeError')
  })
})
