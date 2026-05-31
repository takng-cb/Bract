/**
 * Discord 通知ヘルパー (Issue #25)
 *
 * env DISCORD_WEBHOOK_URL に POST する汎用関数。
 * Vercel deploy 通知、エラー通知、ライセンス期限警告などで再利用する。
 *
 * 設計方針:
 *   - server-side only ('server-only' でクライアントへのバンドル混入を防ぐ)
 *   - DISCORD_WEBHOOK_URL が未設定 / fetch エラーでも throw しない
 *     (通知失敗で本筋の処理が落ちないこと優先)
 *   - 失敗時は console.warn のみ
 *   - rate limit (Discord webhook は 30/min)。10 件溜まったら捨てる簡易バッファは未実装
 *
 * Discord Embed 仕様:
 *   https://discord.com/developers/docs/resources/webhook#execute-webhook
 *
 * 注: 'server-only' を import していないがテスト容易性のため。
 * DISCORD_WEBHOOK_URL は NEXT_PUBLIC_ プレフィックスがないので client バンドル
 * には混入しない (Next.js が自動でフィルタする)。
 */

/** Discord Embed の色 (10進数) */
export const DISCORD_COLOR = {
  success: 0x16a34a,  // green-600
  error:   0xdc2626,  // red-600
  warning: 0xea580c,  // orange-600
  info:    0x2563eb,  // blue-600
  neutral: 0x71717a,  // zinc-500
} as const

export type DiscordEmbedField = {
  name:   string
  value:  string
  inline?: boolean
}

export type DiscordEmbed = {
  title?:       string
  description?: string
  url?:         string
  color?:       number
  fields?:      DiscordEmbedField[]
  timestamp?:   string      // ISO 8601
  footer?:      { text: string; icon_url?: string }
  author?:      { name: string; url?: string; icon_url?: string }
  thumbnail?:   { url: string }
}

export type DiscordPayload = {
  content?: string
  username?: string
  avatar_url?: string
  embeds?:   DiscordEmbed[]
}

/**
 * Discord webhook に投稿する。
 * 失敗しても throw しない (best-effort)。
 */
export async function notifyDiscord(payload: DiscordPayload): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) {
    console.warn('[discord] DISCORD_WEBHOOK_URL not set — skipping notification')
    return { ok: false, error: 'DISCORD_WEBHOOK_URL not set' }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.warn(`[discord] HTTP ${res.status}: ${text.slice(0, 200)}`)
        return { ok: false, error: `HTTP ${res.status}` }
      }
      return { ok: true }
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[discord] fetch failed: ${msg}`)
    return { ok: false, error: msg }
  }
}

/**
 * 単純なテキストメッセージを送る簡易関数。
 */
export async function notifyDiscordText(message: string): Promise<{ ok: boolean; error?: string }> {
  return notifyDiscord({ content: message.slice(0, 2000) })  // Discord 上限 2000 文字
}

/**
 * デプロイ成功通知用の Embed。
 */
export function deploySuccessEmbed(opts: {
  project: string
  url:     string
  branch?: string
  commitSha?:     string
  commitMessage?: string
  commitAuthor?:  string
  inspectorUrl?:  string
}): DiscordEmbed {
  const fields: DiscordEmbedField[] = [
    { name: 'プロジェクト', value: opts.project, inline: true },
  ]
  if (opts.branch)        fields.push({ name: 'ブランチ', value: opts.branch, inline: true })
  if (opts.commitSha)     fields.push({ name: 'コミット', value: opts.commitSha.slice(0, 7), inline: true })
  if (opts.commitMessage) fields.push({ name: 'メッセージ', value: opts.commitMessage.slice(0, 1024) })
  if (opts.commitAuthor)  fields.push({ name: '作者', value: opts.commitAuthor, inline: true })

  return {
    title:       '🟢 デプロイ成功',
    description: `[${opts.url}](https://${opts.url})`,
    url:         opts.inspectorUrl,
    color:       DISCORD_COLOR.success,
    fields,
    timestamp:   new Date().toISOString(),
    footer:      { text: 'Bract CRM · Vercel' },
  }
}

/**
 * デプロイ失敗通知用の Embed。
 */
export function deployErrorEmbed(opts: {
  project: string
  branch?: string
  commitSha?:     string
  commitMessage?: string
  errorMessage?:  string
  inspectorUrl?:  string
}): DiscordEmbed {
  const fields: DiscordEmbedField[] = [
    { name: 'プロジェクト', value: opts.project, inline: true },
  ]
  if (opts.branch)        fields.push({ name: 'ブランチ', value: opts.branch, inline: true })
  if (opts.commitSha)     fields.push({ name: 'コミット', value: opts.commitSha.slice(0, 7), inline: true })
  if (opts.commitMessage) fields.push({ name: 'メッセージ', value: opts.commitMessage.slice(0, 1024) })
  if (opts.errorMessage)  fields.push({ name: 'エラー', value: opts.errorMessage.slice(0, 1024) })

  return {
    title:       '🔴 デプロイ失敗',
    description: opts.inspectorUrl ? `[ビルドログを開く](${opts.inspectorUrl})` : undefined,
    url:         opts.inspectorUrl,
    color:       DISCORD_COLOR.error,
    fields,
    timestamp:   new Date().toISOString(),
    footer:      { text: 'Bract CRM · Vercel' },
  }
}
