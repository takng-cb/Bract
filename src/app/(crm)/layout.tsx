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
import { activeIndustry } from '@/lib/industry'

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
  // INDUSTRY=real-estate のとき、`properties` は overlay の専用ルート (/properties)
  // を持つため、サイドバーリンクは /objects/properties ではなく /properties に向ける。
  // 同様に INDUSTRY=auto-body のとき `vehicles` を /vehicles に向ける。
  const customNavItems: NavItem[] = customObjects
    .filter((o) => o.nav_enabled)
    .map((o) => ({
      href:
        activeIndustry === 'real-estate' && o.api_name === 'properties' ? '/properties' :
        activeIndustry === 'auto-body'   && o.api_name === 'vehicles'   ? '/vehicles'   :
        `/objects/${o.api_name}`,
      label: o.label_plural,
      icon:  o.icon,
    }))

  // 業種オーバーレイ専用のナビ項目（object_definitions に行が無い場合のフォールバック）
  // auto-body の vehicles は新業種なので、初期セットアップ前でもサイドバー表示できるよう
  // ここでハードコードする。重複時は customNavItems が優先される（ユニーク化は applyNavOrder
  // 側ではなく href の重複排除で実装）。
  const industryNavItems: NavItem[] = activeIndustry === 'auto-body'
    ? [{ href: '/vehicles', label: '車両', icon: '🚗' }]
    : []

  const allCustomItems: NavItem[] = [
    ...customNavItems,
    ...industryNavItems.filter((i) => !customNavItems.some((c) => c.href === i.href)),
  ]

  // カスタムオブジェクトを含めてユーザー設定順に並び替え
  const mainItems = applyNavOrder(order, allCustomItems)

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
