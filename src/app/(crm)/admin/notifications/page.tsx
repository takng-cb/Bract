/**
 * 通知設定の admin ページ (Issue #25)
 *
 * env で設定された通知チャンネルの状況確認とテスト送信。
 * 管理者のみアクセス可能。
 */
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import NotificationsTestForm from './NotificationsTestForm'
import { NavIcon } from '@/lib/navIcon'
import PageHeader from '@/components/ui/PageHeader'

export default async function AdminNotificationsPage() {
  const adminFlag = await isAdmin()
  if (!adminFlag) redirect('/dashboard')

  const status = {
    discord: {
      webhookConfigured: !!process.env.DISCORD_WEBHOOK_URL,
    },
    vercel: {
      webhookSecretConfigured: !!process.env.VERCEL_WEBHOOK_SECRET,
    },
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader
        icon="🔔"
        title="通知設定"
        description="外部通知チャンネル（Discord 等）の設定状況と接続テスト。管理者のみアクセス可能。"
      />

      {/* Discord 通知 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-2"><NavIcon icon="💬" className="w-4 h-4" /> Discord 通知</h2>
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${
            status.discord.webhookConfigured ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'
          }`}>
            {status.discord.webhookConfigured ? '設定済み' : '未設定'}
          </span>
        </div>

        <dl className="space-y-3 text-sm mb-4">
          <div className="flex items-start gap-3">
            <dt className="text-zinc-500 w-44 shrink-0">DISCORD_WEBHOOK_URL</dt>
            <dd className={status.discord.webhookConfigured ? 'text-green-700 font-medium' : 'text-rose-700 font-medium'}>
              {status.discord.webhookConfigured ? '✓ env 設定済み' : '✗ env 未設定'}
            </dd>
          </div>
        </dl>

        <NotificationsTestForm enabled={status.discord.webhookConfigured} />
      </section>

      {/* Vercel webhook */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-2"><NavIcon icon="⚙️" className="w-4 h-4" /> Vercel webhook 設定</h2>
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${
            status.vercel.webhookSecretConfigured ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {status.vercel.webhookSecretConfigured ? '署名検証 有効' : '署名検証 未設定'}
          </span>
        </div>

        <dl className="space-y-3 text-sm mb-4">
          <div className="flex items-start gap-3">
            <dt className="text-zinc-500 w-44 shrink-0">VERCEL_WEBHOOK_SECRET</dt>
            <dd className={status.vercel.webhookSecretConfigured ? 'text-green-700' : 'text-yellow-700'}>
              {status.vercel.webhookSecretConfigured
                ? '✓ env 設定済み (HMAC-SHA1 署名検証 ON)'
                : '○ 未設定 (検証なし。本番では設定推奨)'}
            </dd>
          </div>
          <div className="flex items-start gap-3">
            <dt className="text-zinc-500 w-44 shrink-0">Webhook 受信エンドポイント</dt>
            <dd className="font-mono text-xs text-zinc-700 break-all">
              /api/webhooks/vercel
            </dd>
          </div>
        </dl>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900">
          <h3 className="font-semibold mb-2">Vercel webhook 登録手順:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Vercel project → <strong>Settings → Webhooks</strong> を開く</li>
            <li><strong>Create Webhook</strong> をクリック</li>
            <li>URL: <code className="bg-white px-1 rounded">https://&lt;本番URL&gt;/api/webhooks/vercel</code></li>
            <li>Events: <strong>Deployment Succeeded</strong> / <strong>Deployment Error</strong> / <strong>Deployment Canceled</strong></li>
            <li>作成後、表示される <strong>Secret</strong> を <code className="bg-white px-1 rounded">VERCEL_WEBHOOK_SECRET</code> として env に追加</li>
            <li>再デプロイ後、自動で Discord 通知が来る</li>
          </ol>
          <p className="text-xs mt-2 text-blue-700">
            ※ Vercel Pro プラン以上で利用可能。Hobby plan の場合は GitHub Actions 経由での通知を検討。
          </p>
        </div>
      </section>

      {/* 関連 */}
      <section className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs text-zinc-600">
        <p><strong>関連設定:</strong></p>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>env 設定: Vercel project Settings → Environment Variables</li>
          <li>ローカル開発: <code>.env.local</code> に DISCORD_WEBHOOK_URL を追加</li>
          <li>関連 Issue: <a className="text-blue-600 hover:underline" href="https://github.com/takng-cb/Bract-CRM/issues/25" target="_blank">#25 Vercel deploy 失敗時の通知</a></li>
        </ul>
      </section>
    </div>
  )
}
