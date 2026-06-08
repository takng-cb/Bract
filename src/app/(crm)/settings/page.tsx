import PasswordForm from '@/components/PasswordForm'
import ProfileForm from '@/components/ProfileForm'
import SystemSettingsForm from '@/components/SystemSettingsForm'
import DangerZone from '@/components/DangerZone'
import UserManagement from '@/components/UserManagement'
import DashboardWidgetSettings from '@/components/DashboardWidgetSettings'
import { getSystemSettings, SYSTEM_DEFAULTS } from '@/lib/systemSettings'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { isAdminUser } from '@/lib/userRole'
import { listUsers } from '@/app/actions/userManagement'
import { activeIndustry } from '@/lib/industry'
import { widgetsForIndustry } from '@/lib/dashboard/widgets'
import { getDashboardWidgetPrefs } from '@/lib/dashboard/userPrefs'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [systemSettings, userPref, adminFlag] = await Promise.all([
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

  const identities = user?.identities ?? []
  const hasGoogle  = identities.some((i) => i.provider === 'google')
  const hasEmail   = identities.some((i) => i.provider === 'email')

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

        {/* ログイン方法 */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-4">ログイン方法</h2>
          <ul className="space-y-3">
            {/* Google */}
            <li className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${hasGoogle ? 'bg-green-100' : 'bg-zinc-100'}`}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800">Google アカウント</p>
                <p className={`text-xs mt-0.5 ${hasGoogle ? 'text-green-600' : 'text-zinc-400'}`}>
                  {hasGoogle ? '✓ 連携済み' : '未連携'}
                </p>
              </div>
            </li>

            {/* メール/パスワード */}
            <li className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${hasEmail ? 'bg-green-100' : 'bg-zinc-100'}`}>
                ✉️
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800">メール / パスワード</p>
                <p className={`text-xs mt-0.5 ${hasEmail ? 'text-green-600' : 'text-zinc-400'}`}>
                  {hasEmail ? '✓ 設定済み' : '未設定（Google のみでログイン中）'}
                </p>
              </div>
            </li>
          </ul>
        </div>

        <PasswordForm passwordMinLength={passwordMinLen} />

        {/* ダッシュボード表示設定 (各ユーザー単位) */}
        {user && (
          <DashboardWidgetSettings
            availableWidgets={widgetsForIndustry(activeIndustry)}
            currentPrefs={await getDashboardWidgetPrefs(user.id)}
          />
        )}
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

          {/* 管理画面へのリンク */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
            <h3 className="text-sm font-bold text-zinc-700 mb-4">管理画面</h3>
            <div className="space-y-2">
              <a
                href="/admin/objects"
                className="flex items-center justify-between px-4 py-3 rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🗂️</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-800">オブジェクト管理</p>
                    <p className="text-xs text-zinc-400">カスタムオブジェクトとフィールドを管理</p>
                  </div>
                </div>
                <span className="text-zinc-400 group-hover:text-zinc-600">→</span>
              </a>
              <a
                href="/admin/users"
                className="flex items-center justify-between px-4 py-3 rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👥</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-800">ユーザー管理</p>
                    <p className="text-xs text-zinc-400">ユーザーのロールと権限を管理</p>
                  </div>
                </div>
                <span className="text-zinc-400 group-hover:text-zinc-600">→</span>
              </a>
            </div>
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
