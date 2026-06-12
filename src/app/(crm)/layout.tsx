import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import NavigationProgress from '@/components/NavigationProgress'
import NavigationOverlay from '@/components/NavigationOverlay'
import SuspenseRescuer from '@/components/SuspenseRescuer'
import { ALL_NAV_ITEMS, BOTTOM_NAV_ITEMS, customBooksToNavItems, buildExtraNavItems, type NavItem } from '@/lib/navItems'
import { buildNavGroups, applyNavOrderToGroups, parseNavOrder } from '@/lib/navOrder'
import { getSystemSettings } from '@/lib/systemSettings'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getCustomBooksForNav } from '@/lib/bookMetadata'
import { isAdmin, getSupabaseUser } from '@/lib/auth'
import { activeIndustry } from '@/lib/industry'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import { getEnabledModules } from '@/lib/modules/registry'
import { filterNavByRead } from '@/lib/permissions'
import { buildModuleBooks } from '@/lib/modules/quick'
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
  const [pref, sysSettings, customBooks, adminFlag] = await Promise.all([
    user
      ? db.select({
          nav_order:    user_preferences.nav_order,
          display_name: user_preferences.display_name,
        }).from(user_preferences)
          .where(eq(user_preferences.user_id, user.id))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    getSystemSettings(['nav_order', 'company_name', 'mobile_bottom_nav']),
    getCustomBooksForNav(),
    isAdmin(),
  ])

  // ナビ順序の解決（ユーザー設定 → システム設定 → デフォルト）
  // v2（モジュール＋ブックの2階層）/ 旧フラット配列の両形式を受ける（REQ-0035）
  const navOrder = parseNavOrder(pref?.nav_order) ?? parseNavOrder(sysSettings.nav_order)

  const companyName = sysSettings.company_name

  // 表示名の解決
  const displayName: string | null = pref?.display_name ?? user?.email ?? null

  // カスタムブックをナビアイテムに変換
  // 業種オーバーレイで専用ルートを持つもの（real-estate の properties → /properties、
  // auto-body の vehicles → /vehicles）は customBooksToNavItems が自動的に業種別
  // URL を生成する。同じヘルパーを設定画面 (NavOrderEditor) でも使うことで href ドリフトを防止。
  const customNavItems = customBooksToNavItems(
    customBooks.filter((o) => o.nav_enabled),
    activeIndustry,
  )

  // ── モジュール基準ナビ（#22 / REQ-0015 / REQ-0035）─────────────────────
  // 有効モジュールの navItems から**直接**サイドバーを構成する（モジュールを有効化すれば
  // その項目が出る）。モジュールに属さない既存項目（カスタムブック等）は「その他」へ。
  // 保存済みのナビ順序（v2 = モジュール順＋モジュール内ブック順）を適用する。
  const enabledModules = await getEnabledModules()

  const dashboardItem: NavItem | undefined = ALL_NAV_ITEMS.find((i) => i.href === '/dashboard')

  // モジュール外項目の既定順 = 静的ナビ → カスタム/業種フォールバック（dashboard はグループ外）
  const extraItems = buildExtraNavItems(customNavItems, activeIndustry)

  const navGroups = applyNavOrderToGroups(buildNavGroups(enabledModules, extraItems), navOrder)

  // フォールバック（モジュールが1つも nav を持たない異常時）
  if (navGroups.length === 0) {
    navGroups.push({ id: '__all', name: 'メニュー', items: extraItems })
  }

  // ── RBAC: Read 権限が無いブックをナビから除外（ADR-0023）──
  for (const g of navGroups) g.items = await filterNavByRead(g.items)
  const visibleNavGroups = navGroups.filter((g) => g.items.length > 0)

  // ── モバイル下部タブ（システム設定 mobile_bottom_nav。REQ-0041）──
  // 設定の href を可視ナビ項目から解決。見つからない枠は既定→残り候補で埋めて常に4つにする。
  const bottomCandidates: NavItem[] = [
    ...(dashboardItem ? [dashboardItem] : []),
    ...visibleNavGroups.flatMap((g) => g.items),
    ...BOTTOM_NAV_ITEMS,
  ]
  const candidateByHref = new Map(bottomCandidates.map((i) => [i.href, i]))
  let configuredBottom: string[] = []
  try {
    const p = JSON.parse(sysSettings.mobile_bottom_nav)
    if (Array.isArray(p)) configuredBottom = p.filter((x): x is string => typeof x === 'string')
  } catch { /* use defaults */ }
  const bottomNavItems: NavItem[] = []
  const pushBottom = (href: string) => {
    const it = candidateByHref.get(href)
    if (it && !bottomNavItems.some((r) => r.href === href)) bottomNavItems.push(it)
  }
  configuredBottom.forEach(pushBottom)
  ;['/dashboard', '/accounts', '/tasks', '/activities'].forEach((h) => { if (bottomNavItems.length < 4) pushBottom(h) })
  for (const it of bottomCandidates) {
    if (bottomNavItems.length >= 4) break
    if (!bottomNavItems.some((r) => r.href === it.href)) bottomNavItems.push(it)
  }

  // クイック操作ウィザード（REQ-0021）：モジュール → ブック ツリー
  const quickModules = buildModuleBooks(enabledModules)

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
        <Sidebar navGroups={visibleNavGroups} dashboardItem={dashboardItem} companyName={companyName} displayName={displayName} isAdmin={adminFlag} aiEnabled={aiEnabled} />
      </div>
      <div className="print:hidden">
        <MobileNav navGroups={visibleNavGroups} dashboardItem={dashboardItem} companyName={companyName} displayName={displayName} isAdmin={adminFlag} aiEnabled={aiEnabled} />
      </div>
      <main className={`flex-1 min-w-0 overflow-auto pt-14 md:pt-0 print:pt-0 ${impersonation ? 'pb-16' : 'pb-16 md:pb-0'} print:pb-0`}>
        <div className="sticky top-0 z-20">
          <Topbar />
        </div>
        {children}
      </main>
      <div className="print:hidden">
        <BottomNav items={bottomNavItems.slice(0, 4)} />
        <PwaInstallBanner />
      </div>
      <QuickLauncher modules={quickModules} />
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
