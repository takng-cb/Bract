/**
 * システム設定ページ（管理者のみ）。
 *
 * 会社情報・パスワードポリシー・セッション等のシステム設定と、
 * 全データ削除（危険ゾーン）をまとめる。設定ハブ（/settings）から遷移する。
 */
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getSystemSettings } from '@/lib/systemSettings'
import SystemSettingsForm from '@/components/SystemSettingsForm'
import DangerZone from '@/components/DangerZone'
import PageHeader from '@/components/ui/PageHeader'

export default async function AdminSystemPage() {
  if (!(await isAdmin())) redirect('/dashboard')

  const systemSettings = await getSystemSettings([
    'company_name', 'password_min_length',
    'session_timeout_minutes', 'allow_self_registration', 'fiscal_year_start',
  ])

  return (
    <div className="mx-auto max-w-lg p-4 md:p-8 space-y-6">
      <PageHeader
        icon="🛠️"
        title="システム設定"
        description="会社情報・パスワードポリシー・セッション等のシステム全体の設定。管理者のみアクセス可能。"
      />

      <SystemSettingsForm
        current={{
          company_name:            systemSettings.company_name,
          password_min_length:     systemSettings.password_min_length,
          session_timeout_minutes: systemSettings.session_timeout_minutes,
          allow_self_registration: systemSettings.allow_self_registration,
          fiscal_year_start:       systemSettings.fiscal_year_start,
        }}
      />

      <DangerZone />
    </div>
  )
}
