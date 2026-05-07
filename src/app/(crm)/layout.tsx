import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import { getEffectiveNavOrder } from '@/app/actions/navSettings'
import { applyNavOrder, type NavItem } from '@/lib/navItems'
import { getSystemSetting } from '@/lib/systemSettings'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getCustomObjectsForNav } from '@/lib/objectMetadata'
import { isAdmin, getSupabaseUser } from '@/lib/auth'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  // ── Round 1: 独立したクエリを全て並列実行 ──────────────────────────────
  // getSupabaseUser() と isAdmin() は内部で同じ React cache を共有するため
  // auth.getUser() はこのリクエスト全体で1回だけ呼ばれる
  const [order, companyName, user, customObjects, adminFlag, cookieStore] = await Promise.all([
    getEffectiveNavOrder(),
    getSystemSetting('company_name'),
    getSupabaseUser(),          // キャッシュ済み。isAdmin() と auth 呼び出しを共有
    getCustomObjectsForNav(),
    isAdmin(),                  // getSupabaseUser() のキャッシュを再利用するため余分な通信なし
    cookies(),
  ])

  // ── Round 2: ユーザー ID が確定してから表示名を取得 ──────────────────
  let displayName: string | null = user?.email ?? null
  if (user) {
    const pref = await db
      .select({ display_name: user_preferences.display_name })
      .from(user_preferences)
      .where(eq(user_preferences.user_id, user.id))
      .then((r) => r[0] ?? null)
    if (pref?.display_name) displayName = pref.display_name
  }

  // カスタムオブジェクトをナビアイテムに変換して追加
  const customNavItems: NavItem[] = customObjects
    .filter((o) => o.nav_enabled)
    .map((o) => ({
      href:  `/objects/${o.api_name}`,
      label: o.label_plural,
      icon:  o.icon,
    }))

  const mainItems = [...applyNavOrder(order), ...customNavItems]

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
