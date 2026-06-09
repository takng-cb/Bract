'use client'

/**
 * Discord 通知のテスト送信フォーム (Issue #25)
 */
import { useState, useTransition } from 'react'
import { sendTestDiscordNotification } from '@/app/actions/testDiscord'
import { NavIcon } from '@/lib/navIcon'

type Props = {
  enabled: boolean
}

export default function NotificationsTestForm({ enabled }: Props) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleTest() {
    setResult(null)
    startTransition(async () => {
      const r = await sendTestDiscordNotification()
      if (r.ok) {
        setResult({ type: 'success', text: '送信完了。Discord チャンネルを確認してください。' })
      } else {
        setResult({ type: 'error', text: `${r.error}` })
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleTest}
        disabled={!enabled || pending}
        className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white font-medium rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? '送信中...' : (<><NavIcon icon="🧪" className="w-3.5 h-3.5 shrink-0" />テスト送信</>)}
      </button>
      {!enabled && (
        <p className="text-xs text-zinc-500 mt-2">
          DISCORD_WEBHOOK_URL が env に設定されていません。先に Vercel project の env を設定してください。
        </p>
      )}
      {result && (
        <div className={`mt-3 rounded-md p-3 text-sm ${
          result.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {result.text}
        </div>
      )}
    </div>
  )
}
