/**
 * AI 設定ページ（管理者のみ）。
 *
 * 設定項目:
 *   - 使用するプロバイダ (Groq / Gemini / Anthropic)
 *   - 各プロバイダの API キー
 *   - 各プロバイダのモデル名
 *   - 商談まとめプロンプト
 *   - 物件まとめプロンプト
 *
 * API キーは保存後 マスク表示（"保存済み (sk-...) "）して上書き専用。
 */
export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getAISettingsForUI, DEFAULT_OPPORTUNITY_PROMPT, DEFAULT_PROPERTY_PROMPT } from '@/lib/ai/config'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import AISettingsForm from './AISettingsForm'
import PageHeader from '@/components/ui/PageHeader'

export default async function AdminAIPage() {
  const adminFlag = await isAdmin()
  if (!adminFlag) redirect('/dashboard')

  // AI 機能がご契約プランに含まれていない場合は 404
  // （URL を直打ちされても閲覧不可。営業窓口経由でフラグを有効化する運用）
  if (!(await isAIFeatureEnabled())) notFound()

  const settings = await getAISettingsForUI()

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader
        icon="🤖"
        title="AI 設定"
        description="活動・ToDo まとめなどの AI 機能で使用するプロバイダと API キーを設定します。管理者のみアクセス可能。"
      />

      <AISettingsForm
        initial={settings}
        defaultPrompts={{
          opportunitySummary: DEFAULT_OPPORTUNITY_PROMPT,
          propertySummary:    DEFAULT_PROPERTY_PROMPT,
        }}
      />
    </div>
  )
}
