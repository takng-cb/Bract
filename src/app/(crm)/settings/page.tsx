import PasswordForm from '@/components/PasswordForm'
import NavOrderEditor from '@/components/NavOrderEditor'
import ProfileForm from '@/components/ProfileForm'
import SystemSettingsForm from '@/components/SystemSettingsForm'
import DangerZone from '@/components/DangerZone'
import UserManagement from '@/components/UserManagement'
import { getNavOrderSettings } from '@/app/actions/navSettings'
import { getSystemSettings, SYSTEM_DEFAULTS } from '@/lib/systemSettings'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { isAdminUser } from '@/lib/userRole'
import { listUsers } from '@/app/actions/userManagement'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ userOrder, systemOrder }, systemSettings, userPref, adminFlag] = await Promise.all([
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
    user ? isAdminUser(user.id) : Promise.resolve(false),
  ])

  const passwordMinLen = parseInt(
    systemSettings.password_min_length ?? SYSTEM_DEFAULTS.password_min_length, 10
  )

  // 管理者のみ: ユーザー一覧を取得
  const userList = adminFlag ? await listUsers() : []

  return (
    <div className="p-4 md:p-8 max-w-lg space-y-10">

      {/* ══════════════════════════════════════
          一般設定（全ユーザー）
      ══════════════════════════════════════ */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">設定</h1>
          <p className="text-sm text-zinc-500 mt-1">アカウントと表示に関する設定</p>
        </div>

        <ProfileForm
          currentDisplayName={userPref?.display_name ?? null}
          email={user?.email ?? ''}
        />

        <NavOrderEditor userOrder={userOrder} systemOrder={systemOrder} />

        <PasswordForm passwordMinLength={passwordMinLen} />
      </div>

      {/* ══════════════════════════════════════
          管理者設定（admin のみ）
      ══════════════════════════════════════ */}
      {adminFlag && (
        <div className="space-y-6">
          <div className="border-t-2 border-dashed border-zinc-200 pt-8">
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <span>🛡️</span> 管理者設定
            </h2>
            <p className="text-sm text-zinc-500 mt-1">管理者のみ表示されます</p>
          </div>

          {/* ユーザー管理 */}
          <UserManagement
            users={userList}
            currentUserId={user?.id ?? ''}
          />

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

          {/* 危険ゾーン */}
          <DangerZone />
        </div>
      )}
    </div>
  )
}
