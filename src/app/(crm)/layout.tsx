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
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import { getEnabledModules } from '@/lib/modules/registry'
import { buildQuickActionGroups } from '@/lib/modules/quick'
import QuickLauncher from '@/components/QuickLauncher'
import Topbar from '@/components/Topbar'

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
    : activeIndustry === 'staffing'
    ? [
        { href: '/staff',       label: 'スタッフ',  icon: '🧑‍💼' },
        { href: '/assignments', label: '案件',     icon: '📋' },
      ]
    : []

  const allCustomItems: NavItem[] = [
    ...customNavItems,
    ...industryNavItems.filter((i) => !customNavItems.some((c) => c.href === i.href)),
  ]

  // カスタムオブジェクトを含めてユーザー設定順に並び替え
  const mainItems = applyNavOrder(order, allCustomItems)

  // ── モジュール基準ナビ（#22 / REQ-0015）─────────────────────────────
  // 有効モジュールの navItems から**直接**サイドバーを構成する（モジュールを有効化すれば
  // その項目が出る）。モジュールに属さない既存項目（カスタムオブジェクト等）は「その他」へ。
  const enabledModules = await getEnabledModules()
  const CATEGORY_RANK: Record<string, number> = { platform: 0, crm: 1, erp: 2, industry: 3 }

  const dashboardItem: NavItem | undefined = mainItems.find((i) => i.href === '/dashboard')

  const moduleHrefs = new Set<string>()
  const navGroups: { id: string; name: string; items: NavItem[] }[] = enabledModules
    .filter((m) => (m.navItems?.length ?? 0) > 0)
    .sort((a, b) => (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9))
    .map((m) => {
      const items: NavItem[] = (m.navItems ?? []).map((n) => ({ href: n.href, label: n.label, icon: n.icon }))
      items.forEach((i) => moduleHrefs.add(i.href))
      return { id: m.id, name: m.name, items }
    })

  // その他：どのモジュールにも属さない既存nav項目（カスタムオブジェクト/未分類）。dashboard除外。
  const otherItems: NavItem[] = mainItems.filter((i) => i.href !== '/dashboard' && !moduleHrefs.has(i.href))
  if (otherItems.length) navGroups.push({ id: '__other', name: 'その他', items: otherItems })

  // フォールバック（モジュールが1つも nav を持たない異常時）
  if (navGroups.length === 0) {
    navGroups.push({ id: '__all', name: 'メニュー', items: mainItems.filter((i) => i.href !== '/dashboard') })
  }

  // クイックアクセス（REQ-0016）：有効モジュールの起点アクション群
  const quickGroups = buildQuickActionGroups(enabledModules)

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

  // AI 機能のライセンス状態を先に解決 (Sidebar / MobileNav に boolean で渡すため)
  const aiEnabled = await isAIFeatureEnabled()

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
        <Sidebar navGroups={navGroups} dashboardItem={dashboardItem} companyName={companyName} displayName={displayName} isAdmin={adminFlag} aiEnabled={aiEnabled} />
      </div>
      <div className="print:hidden">
        <MobileNav navGroups={navGroups} dashboardItem={dashboardItem} companyName={companyName} displayName={displayName} isAdmin={adminFlag} aiEnabled={aiEnabled} />
      </div>
      <main className={`flex-1 min-w-0 overflow-auto pt-14 md:pt-0 print:pt-0 ${impersonation ? 'pb-16' : 'pb-16 md:pb-0'} print:pb-0`}>
        <div className="sticky top-0 z-20">
          <Topbar />
        </div>
        {children}
      </main>
      <div className="print:hidden">
        <BottomNav />
        <PwaInstallBanner />
      </div>
      <QuickLauncher groups={quickGroups} />
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
