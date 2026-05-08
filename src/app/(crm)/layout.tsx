import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import { applyNavOrder, DEFAULT_NAV_ORDER, type NavItem } from '@/lib/navItems'
import { getSystemSettings } from '@/lib/systemSettings'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getCustomObjectsForNav } from '@/lib/objectMetadata'
import { isAdmin, getSupabaseUser } from '@/lib/auth'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  // ── Round 1: 認証を先に取得してユーザー ID を確定 ───────────────────
  const [user, cookieStore] = await Promise.all([
    getSupabaseUser(),
    cookies(),
  ])

  // ── Round 2: ユーザー ID が確定してから残りを並列実行 ─────────────────
  // user_preferences を1回のクエリで nav_order と display_name の両方を取得
  // system_settings も1回のクエリで nav_order と company_name の両方を取得
  const [pref, sysSettings, customObjects, adminFlag] = await Promise.all([
    user
      ? db.select({
          nav_order:    user_preferences.nav_order,
          display_name: user_preferences.display_name,
        }).from(user_preferences)
          .where(eq(user_preferences.user_id, user.id))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    getSystemSettings(['nav_order', 'company_name']),
    getCustomObjectsForNav(),
    isAdmin(),
  ])

  // ナビ順序の解決（ユーザー設定 → システム設定 → デフォルト）
  let order: string[] = DEFAULT_NAV_ORDER
  if (pref?.nav_order) {
    try { order = JSON.parse(pref.nav_order) as string[] } catch { /* use default */ }
  } else if (sysSettings.nav_order) {
    try { order = JSON.parse(sysSettings.nav_order) as string[] } catch { /* use default */ }
  }

  const companyName = sysSettings.company_name

  // 表示名の解決
  const displayName: string | null = pref?.display_name ?? user?.email ?? null

  // カスタムオブジェクトをナビアイテムに変換
  const customNavItems: NavItem[] = customObjects
    .filter((o) => o.nav_enabled)
    .map((o) => ({
      href:  `/objects/${o.api_name}`,
      label: o.label_plural,
      icon:  o.icon,
    }))

  // カスタムオブジェクトを含めてユーザー設定順に並び替え
  const mainItems = applyNavOrder(order, customNavItems)

  // なりすまし中かどうか確認
  const adminSessionRaw = cookieStore.get('crm_admin_session')?.value
  const impersonation   = adminSessionRaw
    ? (() => {
        try {
          const { adminEmail } = JSON.parse(adminSessionRaw) as { adminEmail: string }
          return { adminEmail, targetEmail: user?.email ?? '' }
        } catch { return null }
      })()
    : null

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar mainItems={mainItems} companyName={companyName} displayName={displayName} isAdmin={adminFlag} />
      <MobileNav mainItems={mainItems} companyName={companyName} isAdmin={adminFlag} />
      <main className={`flex-1 overflow-auto pt-14 md:pt-0 ${impersonation ? 'pb-16' : 'pb-16 md:pb-0'}`}>
        {children}
      </main>
      <BottomNav />
      <PwaInstallBanner />
      {impersonation && (
        <ImpersonationBanner
          adminEmail={impersonation.adminEmail}
          targetEmail={impersonation.targetEmail}
        />
      )}
    </div>
  )
}
