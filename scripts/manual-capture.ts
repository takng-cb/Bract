/**
 * 操作マニュアル用スクリーンショット自動撮影（public/manual/ 用）
 *
 * 使い方:
 *   1. 対象業種で production サーバーを起動しておく:
 *        NEXT_PUBLIC_INDUSTRY=<industry> npx next build --webpack
 *        npx next start -p 3100
 *   2. 撮影:
 *        npx tsx scripts/manual-capture.ts <base|auto-body|real-estate|staffing>
 *
 * 必要 env（.env.local から自動読込）:
 *   TEST_USER_PASSWORD … scripts/seed-test-users.ts で投入した test-admin のパスワード
 *   MANUAL_BASE_URL    … 省略時 http://localhost:3100
 *
 * 出力: public/manual/img/<industry>/<name>.png（1440x900、ja-JP）
 * 機能更新後はサーバーを立て直して本スクリプトを再実行すればスクショを最新化できる。
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { chromium, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.MANUAL_BASE_URL ?? 'http://localhost:3100'
const PASSWORD = process.env.TEST_USER_PASSWORD
const ADMIN    = 'test-admin@bract-crm.local'

type Shot = {
  name: string
  /** 遷移先（省略時は現在のページのまま actions だけ実行） */
  path?: string
  /** ページ到達後の追加操作（ダイアログを開く等） */
  actions?: (page: Page) => Promise<void>
  /** 一覧の先頭レコード詳細へ飛ぶ（path の一覧を開いてから href がこの prefix の最初のリンクをクリック） */
  firstDetailOf?: string
  fullPage?: boolean
}

/** 全業種共通（共通編＋管理者編） */
const COMMON: Shot[] = [
  { name: 'dashboard', path: '/dashboard' },
  // ── 一覧の基本操作（取引先を例に） ──
  { name: 'accounts-list', path: '/accounts' },
  { name: 'accounts-export-dialog', path: '/accounts', actions: async (p) => {
    await p.getByRole('button', { name: 'エクスポート' }).first().click()
    await p.waitForTimeout(400)
  } },
  { name: 'accounts-new', path: '/accounts/new' },
  { name: 'accounts-new-fill-modal', path: '/accounts/new', actions: async (p) => {
    await p.getByRole('button', { name: 'テキストから入力' }).first().click()
    await p.waitForTimeout(400)
  } },
  { name: 'accounts-detail', path: '/accounts', firstDetailOf: '/accounts/' },
  { name: 'contacts-list', path: '/contacts' },
  { name: 'global-search', path: '/dashboard', actions: async (p) => {
    const box = p.locator('input[placeholder*="検索"]').first()
    await box.click()
    await box.fill('株式会社')
    await p.waitForTimeout(1200)
  } },
  // ── 商談（リスト/パイプライン/カレンダー） ──
  { name: 'opportunities-board', path: '/opportunities?view=board' },
  { name: 'opportunities-list', path: '/opportunities?view=list' },
  { name: 'opportunities-calendar', path: '/opportunities?view=calendar' },
  { name: 'opportunities-detail', path: '/opportunities?view=list', firstDetailOf: '/opportunities/' },
  { name: 'forecast', path: '/forecast' },
  // ── ワークスペース ──
  { name: 'activities-list', path: '/activities' },
  { name: 'tasks-list', path: '/tasks' },
  { name: 'tasks-calendar', path: '/tasks?view=calendar' },
  { name: 'approvals', path: '/approvals' },
  { name: 'wiki', path: '/wiki' },
  { name: 'expenses-list', path: '/expenses' },
  // ── モジュールホーム（/modules はルート無し。crm-core のホームを撮る） ──
  { name: 'modules-home', path: '/modules/crm-core' },
]

const ADMIN_SHOTS: Shot[] = [
  { name: 'settings', path: '/settings' },
  { name: 'settings-system', path: '/settings/system' },
  { name: 'admin-users', path: '/admin/users' },
  { name: 'admin-roles', path: '/admin/roles' },
  { name: 'admin-books', path: '/admin/books' },
  { name: 'admin-modules', path: '/admin/modules' },
  { name: 'admin-notifications', path: '/admin/notifications' },
  { name: 'trash', path: '/trash' },
]

const INVENTORY: Shot[] = [
  { name: 'products-list', path: '/products' },
  { name: 'products-detail', path: '/products', firstDetailOf: '/products/' },
  { name: 'warehouses-list', path: '/warehouses' },
  { name: 'stock-movements', path: '/stock-movements' },
  { name: 'stock-movements-new', path: '/stock-movements/new' },
]

const INDUSTRY_SHOTS: Record<string, Shot[]> = {
  'base': [...COMMON, ...INVENTORY, ...ADMIN_SHOTS],
  'auto-body': [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'maintenance-list', path: '/maintenance?view=list' },
    { name: 'maintenance-board', path: '/maintenance?view=board' },
    { name: 'maintenance-calendar', path: '/maintenance?view=calendar' },
    { name: 'maintenance-detail', path: '/maintenance?view=list', firstDetailOf: '/maintenance/' },
    { name: 'maintenance-new', path: '/maintenance/new' },
    { name: 'customer-vehicles-list', path: '/customer-vehicles' },
    { name: 'customer-vehicles-detail', path: '/customer-vehicles', firstDetailOf: '/customer-vehicles/' },
    { name: 'vehicles-list', path: '/vehicles' },
    { name: 'vehicles-detail', path: '/vehicles', firstDetailOf: '/vehicles/' },
    { name: 'parts-list', path: '/parts' },
    { name: 'receivables', path: '/receivables' },
    { name: 'opportunity-new-autobody', path: '/opportunities/new' },
  ],
  'real-estate': [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'properties-list', path: '/properties' },
    { name: 'properties-detail', path: '/properties', firstDetailOf: '/properties/' },
    { name: 'properties-new', path: '/properties/new' },
    { name: 'opportunity-new-realestate', path: '/opportunities/new' },
    { name: 'opportunity-detail-realestate', path: '/opportunities?view=list', firstDetailOf: '/opportunities/' },
  ],
  'staffing': [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'assignments-list', path: '/assignments' },
    { name: 'assignments-detail', path: '/assignments', firstDetailOf: '/assignments/' },
    { name: 'assignments-new', path: '/assignments/new' },
    { name: 'staff-list', path: '/staff' },
    { name: 'staff-detail', path: '/staff', firstDetailOf: '/staff/' },
    { name: 'invoices', path: '/invoices' },
    { name: 'quick-staffing', path: '/quick/staffing' },
  ],
}

/**
 * skeleton（loading.tsx の animate-pulse）が消えるまで待つ。
 * リンククリックによるソフトナビゲーションでは waitForLoadState が即時解決して
 * ローディング中のスクショになる（v1 の不具合）ため、描画完了をこれで判定する。
 */
async function settle(page: Page) {
  await page
    .waitForFunction(() => document.querySelectorAll('[class*="animate-pulse"]').length === 0, undefined, { timeout: 30_000 })
    .catch(() => { console.warn('    （skeleton が残ったまま撮影）') })
  await page.waitForTimeout(600)   // チャート・画像の描画待ち
}

async function main() {
  const industry = process.argv[2]
  if (!industry || !INDUSTRY_SHOTS[industry]) {
    console.error('Usage: npx tsx scripts/manual-capture.ts <base|auto-body|real-estate|staffing>')
    process.exit(1)
  }
  if (!PASSWORD) {
    console.error('TEST_USER_PASSWORD が未設定です（.env.local）')
    process.exit(1)
  }

  const outDir = resolve(process.cwd(), `public/manual/img/${industry}`)
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    baseURL: BASE_URL,
  })
  const page = await ctx.newPage()

  // ── ログイン画面（撮影してからログイン） ──
  await page.goto('/login', { waitUntil: 'networkidle' })
  if (industry === 'base') {
    await page.screenshot({ path: `${outDir}/login.png` })
    console.log('  ✓ login')
  }
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN)
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD)
  await page.getByRole('button', { name: 'メールでログイン' }).click()
  await page.waitForURL(/dashboard|accounts/, { timeout: 30_000 })

  let ok = 0, fail = 0
  for (const shot of INDUSTRY_SHOTS[industry]) {
    try {
      if (shot.path) {
        await page.goto(shot.path, { waitUntil: 'networkidle', timeout: 45_000 })
        await settle(page)
      }
      if (shot.firstDetailOf) {
        // 「UUID で終わる href」だけを詳細リンクとみなす（/new・/templates 等のサブページを除外）
        const hrefs = await page
          .locator(`a[href^="${shot.firstDetailOf}"]`)
          .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')))
        const target = hrefs.find((h) => h && /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(h))
        if (!target) throw new Error(`詳細リンクが見つかりません（${shot.firstDetailOf}<uuid>）`)
        await page.goto(target, { waitUntil: 'networkidle', timeout: 45_000 })
        await settle(page)
      }
      if (shot.actions) await shot.actions(page)
      await page.screenshot({ path: `${outDir}/${shot.name}.png`, fullPage: shot.fullPage ?? false })
      console.log(`  ✓ ${shot.name}`)
      ok++
      // モーダルを開いた場合は Escape で閉じてから次へ
      await page.keyboard.press('Escape')
    } catch (e) {
      console.error(`  ✗ ${shot.name}: ${(e as Error).message.split('\n')[0]}`)
      fail++
    }
  }

  await browser.close()
  console.log(`\n${industry}: ${ok} 枚撮影 / ${fail} 失敗 → public/manual/img/${industry}/`)
  process.exit(fail > 0 ? 1 : 0)
}

main()
