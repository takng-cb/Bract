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
import { NavIcon } from '@/lib/navIcon'

export default async function AdminAIPage() {
  const adminFlag = await isAdmin()
  if (!adminFlag) redirect('/dashboard')

  // AI 機能がご契約プランに含まれていない場合は 404
  // （URL を直打ちされても閲覧不可。営業窓口経由でフラグを有効化する運用）
  if (!(await isAIFeatureEnabled())) notFound()

  const settings = await getAISettingsForUI()

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900"><NavIcon icon="🤖" className="w-6 h-6" />AI 設定</h1>
        <p className="text-sm text-zinc-500 mt-1">
          活動・ToDo まとめなどの AI 機能で使用するプロバイダと API キーを設定します。
          管理者のみアクセス可能。
        </p>
      </div>

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
