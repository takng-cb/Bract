import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import NavigationProgress from '@/components/NavigationProgress'
import NavigationOverlay from '@/components/NavigationOverlay'
import SuspenseRescuer from '@/components/SuspenseRescuer'
import { applyNavOrder, DEFAULT_NAV_ORDER, customObjectsToNavItems, type NavItem } from '@/lib/navItems'
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
  // 業種オーバーレイで専用ルートを持つもの（real-estate の properties → /properties、
  // auto-body の vehicles → /vehicles）は customObjectsToNavItems が自動的に業種別
  // URL を生成する。同じヘルパーを設定画面 (NavOrderEditor) でも使うことで href ドリフトを防止。
  const customNavItems = customObjectsToNavItems(
    customObjects.filter((o) => o.nav_enabled),
    activeIndustry,
  )

  // 業種オーバーレイ専用のナビ項目（object_definitions に行が無い場合のフォールバック）
  // auto-body の vehicles は新業種なので、初期セットアップ前でもサイドバー表示できるよう
  // ここでハードコードする。重複時は customNavItems が優先される（href 重複排除で実装）。
  const industryNavItems: NavItem[] = activeIndustry === 'auto-body'
    ? [
        { href: '/maintenance',           label: '整備',         icon: '🔧' },
        { href: '/maintenance/templates', label: '整備パッケージ', icon: '📋' },
        { href: '/customer-vehicles',     label: '顧客車両',     icon: '🚙' },
        { href: '/vehicles',              label: '車両',         icon: '🚗' },
        { href: '/parts',                 label: '部品',         icon: '🪛' },
        { href: '/receivables',           label: '売掛金',       icon: '💰' },
      ]
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
    <div className="flex min-h-screen bg-zinc-50 print:bg-white print:min-h-0">
      {/* 画面上部の進捗バー + 中央スピナー（perceived perf）*/}
      <div className="print:hidden">
        <NavigationProgress />
        <NavigationOverlay />
        {/* Issue #20: Suspense streaming SSR が完了しない事象の防御的 rescue */}
        <SuspenseRescuer />
      </div>
      <div className="print:hidden">
        <Sidebar mainItems={mainItems} companyName={companyName} displayName={displayName} isAdmin={adminFlag} />
      </div>
      <div className="print:hidden">
        <MobileNav mainItems={mainItems} companyName={companyName} isAdmin={adminFlag} />
      </div>
      <main className={`flex-1 overflow-auto pt-14 md:pt-0 print:pt-0 ${impersonation ? 'pb-16' : 'pb-16 md:pb-0'} print:pb-0`}>
        {children}
      </main>
      <div className="print:hidden">
        <BottomNav />
        <PwaInstallBanner />
      </div>
      {impersonation && (
        <div className="print:hidden">
          <ImpersonationBanner
            adminEmail={impersonation.adminEmail}
            targetEmail={impersonation.targetEmail}
          />
        </div>
      )}
    </div>
  )
}
