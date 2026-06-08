import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import StaffingQuickWizard from '@/industries/staffing/components/StaffingQuickWizard'
import { listClientAccounts } from '@/industries/staffing/actions/quickRegister'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * 人材手配 クイック登録（②AIウィザード）。staffing モジュール有効時のみ。
 */
export default async function StaffingQuickPage() {
  if (!(await isModuleEnabled('staffing'))) notFound()
  const aiOn = await isAIFeatureEnabled()
  const clientAccounts = aiOn ? await listClientAccounts() : []

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">クイック登録（AI起票）</h1>
        <p className="text-sm text-zinc-500 mt-1">
          LINE等の文面を貼り付け → AIが案件情報を抽出 → 確認・編集して起票します。
        </p>
      </header>

      {aiOn ? (
        <StaffingQuickWizard clientAccounts={clientAccounts} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI 機能が無効です。管理者が <Link href="/admin/ai" className="underline">AI 設定</Link> でプロバイダ（Groq 等）と API キーを設定し、
          <code className="mx-1">AI_FEATURE_ENABLED=true</code> を有効化してください。
        </div>
      )}
    </div>
  )
}
