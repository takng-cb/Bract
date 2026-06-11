/**
 * ライセンス管理ページ (Issue #67 Phase 2)
 *
 * 管理者のみアクセス可。テナントの契約状態 + features を編集する。
 *
 * env override の状態も併せて表示し、運用上の混乱を防ぐ。
 */
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getLicense } from '@/lib/license'
import LicenseEditForm from './LicenseEditForm'
import { NavIcon } from '@/lib/navIcon'
import PageHeader from '@/components/ui/PageHeader'

export default async function AdminLicensePage() {
  const adminFlag = await isAdmin()
  if (!adminFlag) redirect('/dashboard')

  const license = await getLicense()

  // env override の現在値を収集 (UI 表示用)
  const envOverrides = {
    AI_FEATURE_ENABLED:   parseEnv(process.env.AI_FEATURE_ENABLED),
    LINE_FEATURE_ENABLED: parseEnv(process.env.LINE_FEATURE_ENABLED),
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        icon="🎫"
        title="ライセンス管理"
        description="テナントの契約状態と機能フラグを管理します。管理者のみアクセス可能。"
      />

      {/* サービス提供者向けである旨の注意（テナント管理者の誤操作防止） */}
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>この画面はサービス提供者（運営）向けです。</b>
        契約プラン・利用上限・契約モジュール（entitled）はサービス提供者が設定します。
        モジュールの日常的な ON/OFF は「ブック/モジュール管理」で行ってください。
      </div>

      <LicenseEditForm
        initial={license}
        envOverrides={envOverrides}
      />

      {/* 補足情報 */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-5 text-sm text-blue-900">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><NavIcon icon="⚙️" className="w-4 h-4" /> 環境変数による override について</h2>
        <p className="mb-2">以下の env 変数は <strong>DB 設定を上書き</strong> します（kill switch として動作）:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><code className="bg-white px-1 rounded">AI_FEATURE_ENABLED</code> = <strong>true</strong> → AI 機能を強制的に有効化</li>
          <li><code className="bg-white px-1 rounded">AI_FEATURE_ENABLED</code> = <strong>false</strong> → AI 機能を強制的に無効化</li>
          <li><code className="bg-white px-1 rounded">LINE_FEATURE_ENABLED</code> = 同上</li>
          <li>未設定 → DB の features 設定値を使用</li>
        </ul>
        <p className="mt-2 text-xs">env 変数は Vercel project の Settings → Environment Variables で設定。</p>
      </div>
    </div>
  )
}

function parseEnv(raw: string | undefined): 'true' | 'false' | 'unset' {
  if (raw === undefined) return 'unset'
  const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled'])
  return TRUTHY.has(raw.trim().toLowerCase()) ? 'true' : 'false'
}
