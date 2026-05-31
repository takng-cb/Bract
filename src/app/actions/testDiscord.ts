'use server'

/**
 * Discord 通知のテスト送信 (Issue #25)
 *
 * 管理者のみが呼べる。env DISCORD_WEBHOOK_URL の疎通確認用。
 */
import { requireAdmin } from '@/lib/auth'
import { notifyDiscord, DISCORD_COLOR } from '@/lib/notifications/discord'

export async function sendTestDiscordNotification(): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  const r = await notifyDiscord({
    username: 'Bract Test',
    embeds: [{
      title:       '🧪 接続テスト',
      description: 'これは Bract CRM からの Discord 通知の接続確認メッセージです。',
      color:       DISCORD_COLOR.info,
      fields: [
        { name: '送信時刻', value: new Date().toLocaleString('ja-JP'), inline: true },
        { name: 'タイプ',   value: 'テスト送信',                       inline: true },
      ],
      footer: { text: 'Bract CRM · 管理画面' },
    }],
  })

  return r.ok ? { ok: true } : { ok: false, error: r.error ?? '不明なエラー' }
}
