/**
 * Vercel deployment webhook 受信ハンドラ (Issue #25)
 *
 * Vercel project の Settings → Webhooks で、このエンドポイントを
 *   https://<本番URL>/api/webhooks/vercel
 * に登録すると、deployment イベントが POST される。
 *
 * 対象イベント:
 *   - deployment.created   (デプロイ開始) — 通知しない (騒がしい)
 *   - deployment.succeeded (成功)         — 通知する
 *   - deployment.error     (失敗)         — 通知する
 *   - deployment.canceled  (キャンセル)   — 通知する
 *
 * セキュリティ:
 *   env VERCEL_WEBHOOK_SECRET が設定されていれば HMAC-SHA1 で署名検証する。
 *   未設定なら全リクエストを通す (開発初期の利便性。本番は必ず設定推奨)。
 *
 * Vercel webhook 仕様:
 *   https://vercel.com/docs/observability/webhooks-overview
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { notifyDiscord, deploySuccessEmbed, deployErrorEmbed, DISCORD_COLOR } from '@/lib/notifications/discord'

type VercelDeploymentPayload = {
  type: string
  createdAt?: number
  payload?: {
    deployment?: {
      id?:           string
      url?:          string
      name?:         string         // project name
      meta?: {
        githubCommitSha?:     string
        githubCommitMessage?: string
        githubCommitAuthorName?: string
        githubCommitRef?:     string
        gitlabCommitSha?:     string
        // ... その他多数
      }
      inspectorUrl?: string
    }
    project?: { name?: string }
    target?:  string                 // 'production' / 'preview'
  }
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET
  if (!secret) return true               // 未設定なら検証しない (開発時)
  if (!signature) return false
  const expected = createHmac('sha1', secret).update(body).digest('hex')
  return signature === expected
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-vercel-signature')

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
  }

  let payload: VercelDeploymentPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = payload.type ?? ''
  const deployment = payload.payload?.deployment
  if (!deployment) {
    return NextResponse.json({ ok: true, skipped: 'no deployment in payload' })
  }

  // 共通 fields の抽出
  const project   = payload.payload?.project?.name ?? deployment.name ?? '(不明)'
  const url       = deployment.url ?? ''
  const branch    = deployment.meta?.githubCommitRef ?? deployment.meta?.gitlabCommitSha ?? undefined
  const commitSha = deployment.meta?.githubCommitSha ?? undefined
  const commitMsg = deployment.meta?.githubCommitMessage ?? undefined
  const author    = deployment.meta?.githubCommitAuthorName ?? undefined
  const target    = payload.payload?.target ?? 'preview'
  const inspectorUrl = deployment.inspectorUrl ?? undefined

  // target='preview' は通知しない (preview deploy は多すぎる)
  // production のみに絞る
  if (target !== 'production') {
    return NextResponse.json({ ok: true, skipped: `target=${target}` })
  }

  let embed
  switch (eventType) {
    case 'deployment.succeeded':
      embed = deploySuccessEmbed({
        project,
        url,
        branch,
        commitSha,
        commitMessage: commitMsg,
        commitAuthor:  author,
        inspectorUrl,
      })
      break

    case 'deployment.error':
      embed = deployErrorEmbed({
        project,
        branch,
        commitSha,
        commitMessage: commitMsg,
        errorMessage: undefined, // Vercel webhook payload はエラー詳細を含まない場合あり
        inspectorUrl,
      })
      break

    case 'deployment.canceled':
      embed = {
        title:       '⚠️ デプロイがキャンセルされました',
        description: inspectorUrl ? `[ビルドログ](${inspectorUrl})` : undefined,
        color:       DISCORD_COLOR.warning,
        fields: [
          { name: 'プロジェクト', value: project, inline: true },
          ...(branch ? [{ name: 'ブランチ', value: branch, inline: true }] : []),
          ...(commitSha ? [{ name: 'コミット', value: commitSha.slice(0, 7), inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
        footer:    { text: 'Bract CRM · Vercel' },
      }
      break

    // deployment.created は通知しない (騒がしい)
    default:
      return NextResponse.json({ ok: true, skipped: `event=${eventType}` })
  }

  const result = await notifyDiscord({ embeds: [embed] })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// GET でヘルスチェック (Vercel webhook 登録時の動作確認用)
export async function GET() {
  const configured = {
    DISCORD_WEBHOOK_URL:    !!process.env.DISCORD_WEBHOOK_URL,
    VERCEL_WEBHOOK_SECRET:  !!process.env.VERCEL_WEBHOOK_SECRET,
  }
  return NextResponse.json({
    ok: true,
    handler: 'Vercel webhook → Discord notification',
    configured,
  })
}
