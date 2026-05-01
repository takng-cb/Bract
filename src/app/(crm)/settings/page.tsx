import PasswordForm from '@/components/PasswordForm'
import NavOrderEditor from '@/components/NavOrderEditor'
import ProfileForm from '@/components/ProfileForm'
import SystemSettingsForm from '@/components/SystemSettingsForm'
import { getNavOrderSettings } from '@/app/actions/navSettings'
import { getSystemSettings, SYSTEM_DEFAULTS } from '@/lib/systemSettings'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ userOrder, systemOrder }, systemSettings, userPref] = await Promise.all([
    getNavOrderSettings(),
    getSystemSettings([
      'company_name', 'password_min_length',
      'session_timeout_minutes', 'allow_self_registration', 'fiscal_year_start',
    ]),
    user
      ? db.select({ display_name: user_preferences.display_name })
          .from(user_preferences)
          .where(eq(user_preferences.user_id, user.id))
          .then((r) => r[0] ?? null)
      : null,
  ])

  const passwordMinLen = parseInt(
    systemSettings.password_min_length ?? SYSTEM_DEFAULTS.password_min_length, 10
  )

  return (
    <div className="p-4 md:p-8 max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">設定</h1>

      {/* プロフィール */}
      <ProfileForm
        currentDisplayName={userPref?.display_name ?? null}
        email={user?.email ?? ''}
      />

      {/* ナビゲーション順序 */}
      <NavOrderEditor userOrder={userOrder} systemOrder={systemOrder} />

      {/* パスワード変更 */}
      <PasswordForm passwordMinLength={passwordMinLen} />

      {/* システム設定 */}
      <SystemSettingsForm
        current={{
          company_name:            systemSettings.company_name,
          password_min_length:     systemSettings.password_min_length,
          session_timeout_minutes: systemSettings.session_timeout_minutes,
          allow_self_registration: systemSettings.allow_self_registration,
          fiscal_year_start:       systemSettings.fiscal_year_start,
        }}
      />
    </div>
  )
}
