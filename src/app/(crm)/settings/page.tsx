import PasswordForm from '@/components/PasswordForm'
import ProfileForm from '@/components/ProfileForm'
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
import { NavIcon } from '@/lib/navIcon'
import { getDashboardWidgetPrefs } from '@/lib/dashboard/userPrefs'
import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { ADMIN_LINKS } from '@/lib/navItems'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'

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

  // 管理者のみ: ユーザー一覧 + AI 機能の有効状態を取得
  const userList = adminFlag ? await listUsers() : []
  const aiEnabled = adminFlag ? await isAIFeatureEnabled() : false
  const adminLinks = ADMIN_LINKS.filter((l) => !l.aiGated || aiEnabled)

  const identities = user?.identities ?? []
  const hasGoogle  = identities.some((i) => i.provider === 'google')
  const hasEmail   = identities.some((i) => i.provider === 'email')

  return (
    <div className="p-4 md:p-8 max-w-lg space-y-10">

      {/* ══════════════════════════════════════
          個人設定（全ユーザー）
      ══════════════════════════════════════ */}
      <div className="space-y-6">
        <PageHeader
          icon="👤"
          title="個人設定"
          description="プロフィール・ログイン方法・表示など、あなた個人の設定"
          className="mb-0"
        />

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
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${hasEmail ? 'bg-green-100' : 'bg-zinc-100'}`}>
                <NavIcon icon="✉️" className="w-4 h-4" />
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
          システム設定（admin のみ・テナント全体）
      ══════════════════════════════════════ */}
      {adminFlag && (
        <div className="space-y-6">
          <div className="border-t-2 border-dashed border-zinc-200 pt-8">
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <NavIcon icon="🛠️" className="w-5 h-5 text-brand-600" /> システム設定
            </h2>
            <p className="text-sm text-zinc-500 mt-1">テナント全体の設定・管理（管理者のみ表示）</p>
          </div>

          {/* 管理画面（システム設定の各画面への入口） */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6">
            <h3 className="text-sm font-bold text-zinc-700 mb-1">管理画面</h3>
            <p className="text-xs text-zinc-400 mb-4">各設定・管理画面へ移動します。</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-zinc-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
                      <NavIcon icon={l.icon} className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{l.label}</p>
                      <p className="text-xs text-zinc-400 truncate">{l.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 group-hover:text-brand-600" />
                </Link>
              ))}
            </div>
          </div>

          {/* ユーザー管理（追加・ロール変更・代理ログイン。パスワード再発行/削除は「ユーザー管理」画面へ） */}
          <UserManagement
            users={userList}
            currentUserId={user?.id ?? ''}
          />
        </div>
      )}
    </div>
  )
}
