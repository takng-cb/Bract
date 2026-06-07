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
  // 有効モジュールの navItems から href→モジュール対応を作り、mainItems をグルーピング。
  // どのモジュールにも属さない項目（カスタムオブジェクト等）は「その他」へ。
  // グループ化できない場合は従来のフラット表示にフォールバック（安全）。
  const enabledModules = await getEnabledModules()
  const hrefToModule = new Map<string, { id: string; name: string; category: string }>()
  for (const m of enabledModules) {
    for (const n of m.navItems ?? []) {
      hrefToModule.set(n.href, { id: m.id, name: m.name, category: m.category })
    }
  }
  const CATEGORY_RANK: Record<string, number> = { platform: 0, crm: 1, erp: 2, industry: 3 }
  let dashboardItem: NavItem | undefined
  const byModule = new Map<string, NavItem[]>()
  const otherItems: NavItem[] = []
  for (const item of mainItems) {
    if (item.href === '/dashboard') { dashboardItem = item; continue }
    const mod = hrefToModule.get(item.href)
    if (mod) {
      const arr = byModule.get(mod.id) ?? []
      arr.push(item)
      byModule.set(mod.id, arr)
    } else {
      otherItems.push(item)
    }
  }
  let navGroups: { id: string; name: string; items: NavItem[] }[] = enabledModules
    .filter((m) => byModule.has(m.id))
    .sort((a, b) => (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9))
    .map((m) => ({ id: m.id, name: m.name, items: byModule.get(m.id)! }))
  if (otherItems.length) navGroups.push({ id: '__other', name: 'その他', items: otherItems })
  if (navGroups.length === 0) {
    navGroups = [{ id: '__all', name: 'メニュー', items: mainItems.filter((i) => i.href !== '/dashboard') }]
  }

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
        <MobileNav mainItems={mainItems} companyName={companyName} isAdmin={adminFlag} aiEnabled={aiEnabled} />
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
